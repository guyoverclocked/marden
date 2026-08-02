import Storage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { sampleDocument } from '../data/sampleDocument';
import { MarkdownDocument, Project } from '../types';

const LIBRARY_KEY = 'marden.library.v1';
const PROJECTS_KEY = 'marden.projects.v1';
const DOCUMENTS_DIRECTORY = 'MardenDocuments';

type StoredDocument = Omit<MarkdownDocument, 'content' | 'cloudId' | 'deviceModifiedAt' | 'cloudModifiedAt'> & {
  content?: string;
  contentFileName?: string;
  cloudId?: string | null;
  deviceModifiedAt?: number;
  cloudModifiedAt?: number;
};

const persistedContent = new Map<string, string>();

const fileNameForDocument = (documentId: string) => `${documentId.replace(/[^A-Za-z0-9_-]/g, '_')}.md`;

const documentsDirectory = () => new Directory(Paths.document, DOCUMENTS_DIRECTORY);

const ensureDocumentsDirectory = () => {
  const directory = documentsDirectory();
  if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
  return directory;
};

const persistDocumentContent = (documentId: string, content: string, fileName?: string) => {
  const resolvedFileName = fileName || fileNameForDocument(documentId);
  if (persistedContent.get(documentId) === content) return resolvedFileName;

  const file = new File(ensureDocumentsDirectory(), resolvedFileName);
  file.write(content);
  persistedContent.set(documentId, content);
  return resolvedFileName;
};

const hydrateNativeDocument = async (stored: StoredDocument): Promise<MarkdownDocument | null> => {
  const contentFileName = stored.contentFileName || fileNameForDocument(stored.id);
  let content = stored.content;

  if (typeof content === 'string') {
    persistDocumentContent(stored.id, content, contentFileName);
  } else {
    const file = new File(ensureDocumentsDirectory(), contentFileName);
    if (!file.exists) return null;
    content = await file.text();
    persistedContent.set(stored.id, content);
  }

  const { contentFileName: _contentFileName, ...metadata } = stored;
  return { ...metadata, content, projectId: stored.projectId ?? null };
};

export const loadLibrary = async (): Promise<MarkdownDocument[]> => {
  const saved = await Storage.getItem(LIBRARY_KEY);
  if (!saved) return [sampleDocument()];

  try {
    const parsed = JSON.parse(saved) as StoredDocument[];
    if (!Array.isArray(parsed)) return [sampleDocument()];
    if (parsed.length === 0) return [];

    if (Platform.OS === 'web') {
      const webDocuments = parsed.filter((document): document is MarkdownDocument => typeof document.content === 'string');
      return webDocuments.map((document) => ({ ...document, projectId: document.projectId ?? null }));
    }

    const hydrated = await Promise.all(parsed.map(hydrateNativeDocument));
    return hydrated.filter((document): document is MarkdownDocument => document !== null);
  } catch {
    return [sampleDocument()];
  }
};

export const saveLibrary = async (documents: MarkdownDocument[]) => {
  if (Platform.OS === 'web') {
    await Storage.setItem(LIBRARY_KEY, JSON.stringify(documents));
    return;
  }

  const storedDocuments: StoredDocument[] = documents.map(({ content, ...metadata }) => ({
    ...metadata,
    contentFileName: persistDocumentContent(metadata.id, content),
  }));

  await Storage.setItem(LIBRARY_KEY, JSON.stringify(storedDocuments));

  const expectedFiles = new Set(storedDocuments.map((document) => document.contentFileName));
  try {
    for (const entry of ensureDocumentsDirectory().list()) {
      if (entry instanceof File && entry.extension.toLowerCase() === '.md' && !expectedFiles.has(entry.name)) {
        entry.delete();
      }
    }
  } catch {
    // Metadata and document bodies are already durable; orphan cleanup is best-effort.
  }
};

export const loadProjects = async (): Promise<Project[]> => {
  const saved = await Storage.getItem(PROJECTS_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved) as Project[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveProjects = async (projects: Project[]) => {
  await Storage.setItem(PROJECTS_KEY, JSON.stringify(projects));
};
