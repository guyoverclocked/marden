import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DocumentActionsModal } from './src/components/DocumentActionsModal';
import { ProjectAssignmentModal } from './src/components/ProjectAssignmentModal';
import { EditorScreen } from './src/screens/EditorScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ReaderScreen } from './src/screens/ReaderScreen';
import { loadLibrary, loadProjects, saveLibrary, saveProjects } from './src/storage/libraryStorage';
import { colors } from './src/theme';
import { MarkdownDocument, Project } from './src/types';
import { createDocument } from './src/utils/markdown';

const isMarkdownFile = (name: string, mimeType?: string) =>
  /\.(md|markdown|mdown|mkd)$/i.test(name) || mimeType === 'text/markdown';
const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
const MARDEN_FONTS = {
  Inter_400Regular: require('./assets/fonts/Inter-Regular.ttf'),
  Inter_500Medium: require('./assets/fonts/Inter-Medium.ttf'),
  Inter_600SemiBold: require('./assets/fonts/Inter-SemiBold.ttf'),
  Inter_700Bold: require('./assets/fonts/Inter-Bold.ttf'),
} as const;

export default function App() {
  const [fontsLoaded] = useFonts(MARDEN_FONTS);
  const [documents, setDocuments] = useState<MarkdownDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [actionDocumentId, setActionDocumentId] = useState<string | null>(null);
  const [movingDocumentId, setMovingDocumentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const hydratedRef = useRef(false);

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

  const saveEditorDocument = (title: string, content: string, projectId: string | null) => {
    const safeName = title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled';
    const document = createDocument(`${safeName}.md`, content, projectId);
    setDocuments((current) => [document, ...current]);
    setEditorOpen(false);
    setActiveDocumentId(document.id);
  };

  const showDocumentMenu = (document: MarkdownDocument) => {
    setActionDocumentId(document.id);
  };

  const actionDocument = documents.find((document) => document.id === actionDocumentId) || null;

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.moss} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {editorOpen ? (
        <EditorScreen
          projects={projects}
          onCancel={() => setEditorOpen(false)}
          onSave={saveEditorDocument}
        />
      ) : activeDocument ? (
        <ReaderScreen
          document={activeDocument}
          onBack={() => setActiveDocumentId(null)}
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
          isLoading={isLoading}
          isImporting={isImporting}
          onImport={importDocuments}
          onCreateDocument={() => setEditorOpen(true)}
          onCreateProject={createProject}
          onOpen={openDocument}
          onDocumentMenu={showDocumentMenu}
        />
      )}
      <DocumentActionsModal
        document={actionDocument}
        onClose={() => setActionDocumentId(null)}
        onMove={() => {
          setActionDocumentId(null);
          setMovingDocumentId(actionDocument?.id || null);
        }}
        onToggleFavorite={() => {
          if (actionDocument) toggleFavorite(actionDocument.id);
          setActionDocumentId(null);
        }}
        onDelete={() => {
          const target = actionDocument;
          setActionDocumentId(null);
          if (!target) return;
          Alert.alert('Delete this file?', 'The copy kept inside Marden will be removed. The original file is unchanged.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => setDocuments((current) => current.filter((item) => item.id !== target.id)),
            },
          ]);
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
            current.map((document) => (document.id === movingDocumentId ? { ...document, projectId } : document)),
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
});
