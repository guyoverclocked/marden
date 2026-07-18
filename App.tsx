import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, StyleSheet, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Storage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DocumentActionsModal } from './src/components/DocumentActionsModal';
import { DocumentDeleteModal } from './src/components/DocumentDeleteModal';
import { DocumentRenameModal } from './src/components/DocumentRenameModal';
import { ProjectAssignmentModal } from './src/components/ProjectAssignmentModal';
import { EditorScreen } from './src/screens/EditorScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ReaderScreen } from './src/screens/ReaderScreen';
import { loadLibrary, loadProjects, saveLibrary, saveProjects } from './src/storage/libraryStorage';
import { colors, darkColors } from './src/theme';
import { MarkdownDocument, Project } from './src/types';
import { createDocument, markdownFileName, safeDocumentName, wordCount } from './src/utils/markdown';

const isMarkdownFile = (name: string, mimeType?: string) =>
  /\.(md|markdown|mdown|mkd)$/i.test(name) || mimeType === 'text/markdown';
const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
const READER_THEME_KEY = 'marden.reader.dark.v1';
const MARDEN_FONTS = {
  Inter_400Regular: require('./assets/fonts/Inter-Regular.ttf'),
  Inter_500Medium: require('./assets/fonts/Inter-Medium.ttf'),
  Inter_600SemiBold: require('./assets/fonts/Inter-SemiBold.ttf'),
  Inter_700Bold: require('./assets/fonts/Inter-Bold.ttf'),
} as const;

export default function App() {
  const systemColorScheme = useColorScheme();
  const [fontsLoaded] = useFonts(MARDEN_FONTS);
  const [documents, setDocuments] = useState<MarkdownDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [actionDocumentId, setActionDocumentId] = useState<string | null>(null);
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [movingDocumentId, setMovingDocumentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [savedDarkMode, setSavedDarkMode] = useState<boolean | null>(null);
  const hydratedRef = useRef(false);
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
        setDocuments(savedDocuments);
        setProjects(savedProjects);
        hydratedRef.current = true;
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

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === activeDocumentId) || null,
    [activeDocumentId, documents],
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

  const toggleFavorite = (documentId: string) => {
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId ? { ...document, isFavorite: !document.isFavorite } : document,
      ),
    );
    void Haptics.selectionAsync();
  };

  const createProject = (name: string, color: string) => {
    const project: Project = {
      id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      color,
      createdAt: Date.now(),
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
    return true;
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingDocumentId(null);
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
        document.id === documentId ? { ...document, title, fileName, modifiedAt: Date.now() } : document,
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
    <SafeAreaProvider>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      {editorOpen ? (
        <EditorScreen
          projects={projects}
          document={editingDocument}
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
        />
      ) : (
        <LibraryScreen
          documents={documents}
          projects={projects}
          darkMode={darkMode}
          isLoading={isLoading}
          isImporting={isImporting}
          onImport={importDocuments}
          onCreateDocument={() => {
            setEditingDocumentId(null);
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
          setDocuments((current) => current.filter((document) => document.id !== deletingDocumentId));
          setDeletingDocumentId(null);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
              document.id === movingDocumentId ? { ...document, projectId, modifiedAt: Date.now() } : document,
            ),
          );
          setMovingDocumentId(null);
          void Haptics.selectionAsync();
        }}
      />
    </SafeAreaProvider>
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
});
