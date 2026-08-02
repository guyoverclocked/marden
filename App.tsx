import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Storage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useIncomingShare } from 'expo-sharing';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DocumentActionsModal } from './src/components/DocumentActionsModal';
import { DocumentDeleteModal } from './src/components/DocumentDeleteModal';
import { DocumentRenameModal } from './src/components/DocumentRenameModal';
import { ProjectAssignmentModal } from './src/components/ProjectAssignmentModal';
import { UpdateModal } from './src/components/UpdateModal';
import { AuthProvider } from './src/auth/AuthContext';
import { EditorScreen } from './src/screens/EditorScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ReaderScreen } from './src/screens/ReaderScreen';
import { createLibraryBackup, mergeLibraryBackup, parseLibraryBackup } from './src/storage/libraryBackup';
import { loadLibrary, loadProjects, saveLibrary, saveProjects } from './src/storage/libraryStorage';
import { requestSync } from './src/storage/syncEngine';
import { colors, darkColors } from './src/theme';
import { MarkdownDocument, Project } from './src/types';
import { checkForUpdate } from './src/utils/updateChecker';
import type { UpdateInfo } from './src/utils/updateChecker';
import { createDocument, markdownFileName, safeDocumentName, titleFromMarkdown, wordCount } from './src/utils/markdown';

const isMarkdownFile = (name: string, mimeType?: string | null) =>
  /\.(md|markdown|mdown|mkd)$/i.test(name) ||
  mimeType === 'text/markdown' ||
  mimeType === 'text/x-markdown';
const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
const READER_THEME_KEY = 'marden.reader.dark.v1';
const DELETE_UNDO_DURATION = 6_000;
const MARDEN_FONTS = {
  Inter_400Regular: require('./assets/fonts/Inter-Regular.ttf'),
  Inter_500Medium: require('./assets/fonts/Inter-Medium.ttf'),
  Inter_600SemiBold: require('./assets/fonts/Inter-SemiBold.ttf'),
  Inter_700Bold: require('./assets/fonts/Inter-Bold.ttf'),
} as const;

type EditorDraft = {
  title: string;
  content: string;
  projectId: string | null;
};

type PendingExternalMarkdown = {
  name: string;
  content: string;
};

const backupFileName = () => {
  const date = new Date().toISOString().slice(0, 10);
  return `Marden-backup-${date}.json`;
};

const downloadBackupOnWeb = (serializedBackup: string, fileName: string) => {
  const backupBlob = new Blob([serializedBackup], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(backupBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
};

const fileNameFromUri = (uri: string) => {
  const path = uri.split(/[?#]/, 1)[0];
  const encodedName = path.split('/').pop() || 'Shared Markdown.md';
  try {
    return decodeURIComponent(encodedName);
  } catch {
    return encodedName;
  }
};

function IncomingMarkdownShare({
  onOpenMarkdown,
}: {
  onOpenMarkdown: (name: string, content: string) => void;
}) {
  const { resolvedSharedPayloads, isResolving, clearSharedPayloads } = useIncomingShare();
  const handledPayloadsRef = useRef(new Set<string>());

  useEffect(() => {
    if (isResolving || resolvedSharedPayloads.length === 0) return undefined;

    let cancelled = false;
    const receiveMarkdown = async () => {
      for (const payload of resolvedSharedPayloads) {
        if (payload.contentType !== 'file') continue;

        const payloadKey = `${payload.contentUri}|${payload.originalName || ''}`;
        if (handledPayloadsRef.current.has(payloadKey)) continue;
        handledPayloadsRef.current.add(payloadKey);

        const name = payload.originalName || fileNameFromUri(payload.contentUri);
        if (!isMarkdownFile(name, payload.contentMimeType || payload.mimeType)) continue;
        if (payload.contentSize && payload.contentSize > MAX_MARKDOWN_BYTES) {
          Alert.alert('Large file not opened', `${name} exceeds Marden’s 2 MB reading limit.`);
          continue;
        }

        try {
          const content = await new ExpoFile(payload.contentUri).text();
          if (cancelled) return;
          if (content.length > MAX_MARKDOWN_BYTES) {
            Alert.alert('Large file not opened', `${name} exceeds Marden’s 2 MB reading limit.`);
            continue;
          }
          onOpenMarkdown(name, content);
        } catch {
          if (!cancelled) Alert.alert('Could not open file', `Marden could not read ${name}.`);
        }
      }
      clearSharedPayloads();
    };

    void receiveMarkdown();
    return () => {
      cancelled = true;
    };
  }, [clearSharedPayloads, isResolving, onOpenMarkdown, resolvedSharedPayloads]);

  return null;
}

export default function App() {
  const systemColorScheme = useColorScheme();
  const [fontsLoaded] = useFonts(MARDEN_FONTS);
  const [documents, setDocuments] = useState<MarkdownDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<EditorDraft | null>(null);
  const [actionDocumentId, setActionDocumentId] = useState<string | null>(null);
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [movingDocumentId, setMovingDocumentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<MarkdownDocument | null>(null);
  const [savedDarkMode, setSavedDarkMode] = useState<boolean | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null);
  const hydratedRef = useRef(false);
  const pendingExternalMarkdownRef = useRef<PendingExternalMarkdown[]>([]);
  const handledExternalUrisRef = useRef(new Set<string>());
  const pendingDeletionRef = useRef<MarkdownDocument | null>(null);
  const pendingDeletionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const darkMode = savedDarkMode ?? systemColorScheme === 'dark';

  useEffect(() => {
    Storage.getItem(READER_THEME_KEY).then((savedTheme) => {
      if (savedTheme !== null) setSavedDarkMode(savedTheme === 'true');
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadLibrary(), loadProjects()])
      .then(([savedDocuments, savedProjects]) => {
        if (!mounted) return;
        const queuedExternalDocuments = pendingExternalMarkdownRef.current.splice(0).map(({ name, content }) =>
          createDocument(name, content),
        );
        hydratedRef.current = true;
        setDocuments([...queuedExternalDocuments, ...savedDocuments]);
        setProjects(savedProjects);
        if (queuedExternalDocuments[0]) {
          setActiveDocumentId(queuedExternalDocuments[0].id);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      })
      .catch(() => {
        Alert.alert('Library unavailable', 'Marden could not open its local library. Please restart the app.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = setTimeout(() => {
      Promise.all([saveLibrary(documents), saveProjects(projects)]).catch(() => {
        Alert.alert('Could not save', 'Your latest library change could not be written to this device.');
      });
    }, 280);
    return () => clearTimeout(timer);
  }, [documents, projects]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    requestSync();
  }, [documents, projects]);

  useEffect(() => {
    const appVersion = require('./app.json').expo.version;
    checkForUpdate(appVersion, Storage).then((update) => {
      if (update) setAvailableUpdate(update);
    });
  }, []);

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === activeDocumentId) || null,
    [activeDocumentId, documents],
  );

  const libraryDocuments = useMemo(
    () => documents.filter((document) => !document.deletedAt && document.id !== pendingDeletion?.id),
    [documents, pendingDeletion],
  );

  const commitPendingDeletion = (documentId?: string) => {
    const pendingDocument = pendingDeletionRef.current;
    if (!pendingDocument || (documentId && pendingDocument.id !== documentId)) return;

    if (pendingDeletionTimerRef.current) clearTimeout(pendingDeletionTimerRef.current);
    pendingDeletionTimerRef.current = null;
    pendingDeletionRef.current = null;
    setPendingDeletion(null);
    // Soft-delete: mark the document deleted so the next sync propagates the
    // deletion to the cloud (and thus to other devices).
    const now = Date.now();
    setDocuments((current) =>
      current.map((document) =>
        document.id === pendingDocument.id
          ? { ...document, deletedAt: now, modifiedAt: now, deviceModifiedAt: now }
          : document,
      ),
    );
  };

  const undoPendingDeletion = () => {
    if (!pendingDeletionRef.current) return;
    if (pendingDeletionTimerRef.current) clearTimeout(pendingDeletionTimerRef.current);
    pendingDeletionTimerRef.current = null;
    const restoredDocument = pendingDeletionRef.current;
    pendingDeletionRef.current = null;
    setPendingDeletion(null);
    // Restore the soft-deleted document so the deletion is not propagated.
    const now = Date.now();
    setDocuments((current) =>
      current.map((document) =>
        document.id === restoredDocument.id
          ? { ...document, deletedAt: undefined, modifiedAt: now, deviceModifiedAt: now }
          : document,
      ),
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const beginPendingDeletion = (document: MarkdownDocument) => {
    commitPendingDeletion();
    pendingDeletionRef.current = document;
    setPendingDeletion(document);
    pendingDeletionTimerRef.current = setTimeout(() => {
      commitPendingDeletion(document.id);
    }, DELETE_UNDO_DURATION);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  useEffect(
    () => () => {
      if (pendingDeletionTimerRef.current) clearTimeout(pendingDeletionTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!activeDocumentId) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveDocumentId(null);
      return true;
    });
    return () => subscription.remove();
  }, [activeDocumentId]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setSavedDarkMode(next);
    void Storage.setItem(READER_THEME_KEY, String(next));
  };

  const openDocument = (document: MarkdownDocument) => {
    const openedAt = Date.now();
    setDocuments((current) =>
      current.map((item) => (item.id === document.id ? { ...item, lastOpenedAt: openedAt } : item)),
    );
    setActiveDocumentId(document.id);
    void Haptics.selectionAsync();
  };

  const openExternalMarkdown = useCallback((name: string, content: string) => {
    if (!isMarkdownFile(name)) {
      Alert.alert('Markdown files only', 'Choose a file ending in .md or .markdown.');
      return;
    }
    if (content.length > MAX_MARKDOWN_BYTES) {
      Alert.alert('Large file not opened', `${name} exceeds Marden’s 2 MB reading limit.`);
      return;
    }

    if (!hydratedRef.current) {
      pendingExternalMarkdownRef.current.push({ name, content });
      return;
    }

    const document = createDocument(name, content);
    setEditorOpen(false);
    setEditingDocumentId(null);
    setEditorDraft(null);
    setActionDocumentId(null);
    setRenamingDocumentId(null);
    setDeletingDocumentId(null);
    setMovingDocumentId(null);
    setDocuments((current) => [document, ...current]);
    setActiveDocumentId(document.id);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const openMarkdownFromUri = useCallback(async (uri: string) => {
    const file = new ExpoFile(uri);
    try {
      const name = file.name || fileNameFromUri(uri);
      if (!isMarkdownFile(name)) return;
      const content = await file.text();
      openExternalMarkdown(name, content);
    } catch {
      Alert.alert('Could not open file', 'Marden could not read this Markdown file.');
    }
  }, [openExternalMarkdown]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    const handleUrl = (url: string) => {
      if (!/^(content|file):/i.test(url) || handledExternalUrisRef.current.has(url)) return;
      handledExternalUrisRef.current.add(url);
      void openMarkdownFromUri(url);
    };

    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [openMarkdownFromUri]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    return window.mardenDesktop?.onOpenMarkdown(({ name, content }) => openExternalMarkdown(name, content));
  }, [openExternalMarkdown]);

  const importDocuments = async () => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/markdown', 'text/plain', 'application/octet-stream'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const imported: MarkdownDocument[] = [];
      let skipped = 0;
      let oversized = 0;
      for (const asset of result.assets) {
        if (!isMarkdownFile(asset.name, asset.mimeType)) {
          skipped += 1;
          continue;
        }
        if (asset.size && asset.size > MAX_MARKDOWN_BYTES) {
          oversized += 1;
          continue;
        }
        const content = asset.file ? await asset.file.text() : await new ExpoFile(asset.uri).text();
        if (content.length > MAX_MARKDOWN_BYTES) {
          oversized += 1;
          continue;
        }
        imported.push(createDocument(asset.name, content));
      }

      if (imported.length === 0) {
        Alert.alert('No Markdown found', 'Choose a file ending in .md or .markdown.');
        return;
      }

      setDocuments((current) => [...imported, ...current]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (imported.length === 1) {
        setActiveDocumentId(imported[0].id);
      } else {
        Alert.alert('Files imported', `${imported.length} Markdown files are now in your library.`);
      }

      if (skipped > 0) {
        Alert.alert('Some files were skipped', `${skipped} selected file${skipped === 1 ? '' : 's'} were not Markdown.`);
      }
      if (oversized > 0) {
        Alert.alert(
          'Large files were skipped',
          `${oversized} file${oversized === 1 ? '' : 's'} exceeded Marden’s 2 MB reading limit.`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The selected file could not be read.';
      Alert.alert('Import failed', message);
    } finally {
      setIsImporting(false);
    }
  };

  const pasteFromClipboard = async () => {
    if (isPasting) return;
    setIsPasting(true);
    try {
      const content = await Clipboard.getStringAsync();
      if (!content.trim()) {
        Alert.alert('Nothing to capture', 'Copy some Markdown or text, then try again.');
        return;
      }

      setEditingDocumentId(null);
      setEditorDraft({
        title: titleFromMarkdown(content, 'Untitled.md'),
        content,
        projectId: null,
      });
      setEditorOpen(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Clipboard unavailable', 'Marden could not read your clipboard. Try pasting directly in the editor instead.');
    } finally {
      setIsPasting(false);
    }
  };

  const exportBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const serializedBackup = JSON.stringify(
        createLibraryBackup(documents.filter((document) => !document.deletedAt), projects),
        null,
        2,
      );
      const fileName = backupFileName();

      if (Platform.OS === 'web') {
        downloadBackupOnWeb(serializedBackup, fileName);
      } else {
        const backupFile = new ExpoFile(Paths.cache, fileName);
        backupFile.write(serializedBackup);
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error('Sharing is not available on this device.');
        }
        await Sharing.shareAsync(backupFile.uri, {
          dialogTitle: 'Save your Marden backup',
          mimeType: 'application/json',
          UTI: 'public.json',
        });
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Marden could not create a backup.';
      Alert.alert('Backup failed', message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const restoreBackup = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const serializedBackup = asset.file ? await asset.file.text() : await new ExpoFile(asset.uri).text();
      const backup = parseLibraryBackup(serializedBackup);
      const merged = mergeLibraryBackup(documents, projects, backup);

      if (merged.restoredDocumentCount === 0 && merged.restoredProjectCount === 0) {
        Alert.alert('Nothing new to restore', 'Everything in this backup is already in your library.');
        return;
      }

      const parts = [
        merged.restoredDocumentCount > 0
          ? `${merged.restoredDocumentCount} document${merged.restoredDocumentCount === 1 ? '' : 's'}`
          : null,
        merged.restoredProjectCount > 0
          ? `${merged.restoredProjectCount} project${merged.restoredProjectCount === 1 ? '' : 's'}`
          : null,
      ].filter((part): part is string => Boolean(part));
      const skipped = merged.skippedDocumentCount > 0
        ? ` ${merged.skippedDocumentCount} identical document${merged.skippedDocumentCount === 1 ? ' was' : 's were'} skipped.`
        : '';

      Alert.alert(
        'Add this backup to Marden?',
        `This will add ${parts.join(' and ')}. Existing documents will not be replaced.${skipped}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add to library',
            onPress: () => {
              setDocuments(merged.documents);
              setProjects(merged.projects);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The selected backup could not be read.';
      Alert.alert('Restore failed', message);
    } finally {
      setIsRestoring(false);
    }
  };

  const toggleFavorite = (documentId: string) => {
    const now = Date.now();
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId
          ? { ...document, isFavorite: !document.isFavorite, modifiedAt: now, deviceModifiedAt: now }
          : document,
      ),
    );
    void Haptics.selectionAsync();
  };

  const createProject = (name: string, color: string) => {
    const now = Date.now();
    const project: Project = {
      id: `project-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      color,
      createdAt: now,
      deviceModifiedAt: now,
    };
    setProjects((current) => [...current, project]);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return project;
  };

  const editingDocument = documents.find((document) => document.id === editingDocumentId) || null;

  const saveEditorDocument = (title: string, content: string, projectId: string | null) => {
    const safeTitle = safeDocumentName(title);
    const fileName = editingDocument && safeTitle === editingDocument.title
      ? editingDocument.fileName
      : markdownFileName(safeTitle);
    const duplicate = documents.some(
      (document) => document.id !== editingDocumentId && document.fileName.toLowerCase() === fileName.toLowerCase(),
    );
    if (duplicate) {
      Alert.alert('That name is already used', 'Choose a different name so both Markdown files stay easy to find.');
      return false;
    }

    if (editingDocument) {
      const now = Date.now();
      setDocuments((current) =>
        current.map((document) =>
          document.id === editingDocument.id
            ? {
                ...document,
                title: safeTitle,
                fileName,
                content,
                projectId,
                wordCount: wordCount(content),
                modifiedAt: now,
                lastOpenedAt: now,
                deviceModifiedAt: now,
              }
            : document,
        ),
      );
      setActiveDocumentId(editingDocument.id);
    } else {
      const document = createDocument(fileName, content, projectId, safeTitle);
      setDocuments((current) => [document, ...current]);
      setActiveDocumentId(document.id);
    }

    setEditorOpen(false);
    setEditingDocumentId(null);
    setEditorDraft(null);
    return true;
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingDocumentId(null);
    setEditorDraft(null);
  };

  const renameDocument = (documentId: string, nextName: string) => {
    const title = safeDocumentName(nextName);
    const fileName = markdownFileName(title);
    const duplicate = documents.some(
      (document) => document.id !== documentId && document.fileName.toLowerCase() === fileName.toLowerCase(),
    );
    if (duplicate) {
      Alert.alert('That name is already used', 'Choose a different name so both Markdown files stay easy to find.');
      return;
    }
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId
          ? { ...document, title, fileName, modifiedAt: Date.now(), deviceModifiedAt: Date.now() }
          : document,
      ),
    );
    setRenamingDocumentId(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const showDocumentMenu = (document: MarkdownDocument) => {
    setActionDocumentId(document.id);
  };

  const actionDocument = documents.find((document) => document.id === actionDocumentId) || null;

  if (!fontsLoaded) {
    return (
      <View style={[styles.loading, darkMode && styles.loadingDark]}>
        <ActivityIndicator color={darkMode ? darkColors.moss : colors.moss} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <SafeAreaProvider>
        {Platform.OS !== 'web' ? <IncomingMarkdownShare onOpenMarkdown={openExternalMarkdown} /> : null}
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        {editorOpen ? (
          <EditorScreen
            projects={projects}
            document={editingDocument}
            initialDraft={editorDraft}
            initialMode={editorDraft ? 'preview' : 'edit'}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            onCancel={closeEditor}
            onSave={saveEditorDocument}
          />
        ) : activeDocument ? (
          <ReaderScreen
            document={activeDocument}
            darkMode={darkMode}
            onBack={() => setActiveDocumentId(null)}
            onToggleDarkMode={toggleDarkMode}
            onToggleFavorite={() => toggleFavorite(activeDocument.id)}
            onProgress={(readingProgress) => {
              setDocuments((current) =>
                current.map((document) =>
                  document.id === activeDocument.id ? { ...document, readingProgress } : document,
                ),
              );
            }}
            onDocumentContentChange={(content) => {
              setDocuments((current) =>
                current.map((document) => {
                  if (document.id !== activeDocument.id) return document;
                  return {
                    ...document,
                    content,
                    wordCount: wordCount(content),
                    modifiedAt: Date.now(),
                    deviceModifiedAt: Date.now(),
                  };
                }),
              );
            }}
          />
        ) : (
          <LibraryScreen
            documents={libraryDocuments}
            projects={projects}
            darkMode={darkMode}
            isLoading={isLoading}
            isImporting={isImporting}
            isPasting={isPasting}
            isBackingUp={isBackingUp}
            isRestoring={isRestoring}
            onImport={importDocuments}
            onPasteFromClipboard={pasteFromClipboard}
            onExportBackup={exportBackup}
            onRestoreBackup={restoreBackup}
            onCreateDocument={() => {
              setEditingDocumentId(null);
              setEditorDraft(null);
              setEditorOpen(true);
            }}
            onCreateProject={createProject}
            onOpen={openDocument}
            onDocumentMenu={showDocumentMenu}
          />
        )}
        <DocumentActionsModal
          document={actionDocument}
          onClose={() => setActionDocumentId(null)}
          onEdit={() => {
            if (!actionDocument) return;
            setEditingDocumentId(actionDocument.id);
            setEditorDraft(null);
            setActionDocumentId(null);
            setEditorOpen(true);
          }}
          onRename={() => {
            setRenamingDocumentId(actionDocument?.id || null);
            setActionDocumentId(null);
          }}
          onMove={() => {
            setActionDocumentId(null);
            setMovingDocumentId(actionDocument?.id || null);
          }}
          onToggleFavorite={() => {
            if (actionDocument) toggleFavorite(actionDocument.id);
            setActionDocumentId(null);
          }}
          onDelete={() => {
            setDeletingDocumentId(actionDocument?.id || null);
            setActionDocumentId(null);
          }}
        />
        <DocumentDeleteModal
          document={documents.find((document) => document.id === deletingDocumentId) || null}
          onClose={() => setDeletingDocumentId(null)}
          onConfirm={() => {
            const document = documents.find((item) => item.id === deletingDocumentId);
            if (document) beginPendingDeletion(document);
            setDeletingDocumentId(null);
          }}
        />
        <DocumentRenameModal
          document={documents.find((document) => document.id === renamingDocumentId) || null}
          onClose={() => setRenamingDocumentId(null)}
          onSave={(name) => {
            if (renamingDocumentId) renameDocument(renamingDocumentId, name);
          }}
        />
        <ProjectAssignmentModal
          visible={movingDocumentId !== null}
          documentTitle={documents.find((document) => document.id === movingDocumentId)?.title}
          currentProjectId={documents.find((document) => document.id === movingDocumentId)?.projectId || null}
          projects={projects}
          onClose={() => setMovingDocumentId(null)}
          onSelect={(projectId) => {
            setDocuments((current) =>
              current.map((document) =>
                document.id === movingDocumentId
                  ? { ...document, projectId, modifiedAt: Date.now(), deviceModifiedAt: Date.now() }
                  : document,
              ),
            );
            setMovingDocumentId(null);
            void Haptics.selectionAsync();
          }}
        />
        {pendingDeletion ? (
          <View style={[styles.undoSnackbar, darkMode && styles.undoSnackbarDark]}>
            <Text numberOfLines={1} style={[styles.undoText, darkMode && styles.undoTextDark]}>
              {pendingDeletion.title} removed
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Undo deletion of ${pendingDeletion.title}`}
              onPress={undoPendingDeletion}
              style={({ pressed }) => [styles.undoButton, pressed && styles.undoButtonPressed]}
            >
              <Text style={styles.undoButtonText}>Undo</Text>
            </Pressable>
          </View>
        ) : null}
        {availableUpdate ? (
          <UpdateModal
            updateInfo={availableUpdate}
            darkMode={darkMode}
            onDismiss={() => setAvailableUpdate(null)}
          />
        ) : null}
      </SafeAreaProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  loadingDark: {
    backgroundColor: darkColors.canvas,
  },
  undoSnackbar: {
    position: 'absolute',
    right: 20,
    bottom: 104,
    left: 20,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 17,
    paddingRight: 10,
    borderRadius: 17,
    backgroundColor: colors.ink,
  },
  undoSnackbarDark: {
    backgroundColor: darkColors.paperStrong,
    borderWidth: 1,
    borderColor: darkColors.line,
  },
  undoText: {
    flex: 1,
    minWidth: 0,
    color: colors.paper,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  undoTextDark: {
    color: darkColors.ink,
  },
  undoButton: {
    minWidth: 64,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 9,
    borderRadius: 20,
    backgroundColor: colors.lime,
  },
  undoButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  undoButtonText: {
    color: colors.mossDark,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
});
