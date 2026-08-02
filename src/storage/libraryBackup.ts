import { MarkdownDocument, Project } from '../types';
import { markdownFileName, safeDocumentName, stripExtension, wordCount } from '../utils/markdown';

export const BACKUP_FORMAT = 'marden-library-backup';
export const BACKUP_VERSION = 1;

const MAX_BACKUP_CHARACTERS = 25 * 1024 * 1024;

export type MardenLibraryBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  documents: MarkdownDocument[];
  projects: Project[];
};

export type BackupMergeResult = {
  documents: MarkdownDocument[];
  projects: Project[];
  restoredDocumentCount: number;
  restoredProjectCount: number;
  skippedDocumentCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isProject = (value: unknown): value is Project =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.color === 'string' &&
  isFiniteNumber(value.createdAt);

const isDocument = (value: unknown): value is MarkdownDocument =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.fileName === 'string' &&
  typeof value.content === 'string' &&
  isFiniteNumber(value.createdAt) &&
  isFiniteNumber(value.modifiedAt) &&
  isFiniteNumber(value.lastOpenedAt) &&
  typeof value.isFavorite === 'boolean' &&
  isFiniteNumber(value.readingProgress) &&
  isFiniteNumber(value.wordCount) &&
  (typeof value.projectId === 'string' || value.projectId === null);

const uniqueId = (desired: string, usedIds: Set<string>) => {
  let candidate = desired || 'restored-item';
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${desired || 'restored-item'}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
};

const uniqueFileName = (fileName: string, usedFileNames: Set<string>) => {
  const baseName = safeDocumentName(stripExtension(fileName));
  let candidate = markdownFileName(baseName);
  let suffix = 2;
  while (usedFileNames.has(candidate.toLocaleLowerCase())) {
    candidate = markdownFileName(`${baseName} (${suffix})`);
    suffix += 1;
  }
  usedFileNames.add(candidate.toLocaleLowerCase());
  return candidate;
};

export const createLibraryBackup = (
  documents: MarkdownDocument[],
  projects: Project[],
): MardenLibraryBackup => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: Date.now(),
  documents: documents.map((document) => ({
    ...document,
    cloudId: undefined,
    cloudUserId: undefined,
    cloudModifiedAt: undefined,
    cloudVersion: undefined,
    syncedDeviceModifiedAt: undefined,
  })),
  projects: projects.map((project) => ({
    ...project,
    cloudId: undefined,
    cloudUserId: undefined,
    cloudModifiedAt: undefined,
    cloudVersion: undefined,
    syncedDeviceModifiedAt: undefined,
  })),
});

export const parseLibraryBackup = (serializedBackup: string): MardenLibraryBackup => {
  if (serializedBackup.length > MAX_BACKUP_CHARACTERS) {
    throw new Error('This backup is larger than Marden can safely restore.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedBackup);
  } catch {
    throw new Error('This file is not valid JSON. Choose a Marden backup file.');
  }

  if (
    !isRecord(parsed) ||
    parsed.format !== BACKUP_FORMAT ||
    parsed.version !== BACKUP_VERSION ||
    !isFiniteNumber(parsed.exportedAt) ||
    !Array.isArray(parsed.documents) ||
    !Array.isArray(parsed.projects) ||
    !parsed.documents.every(isDocument) ||
    !parsed.projects.every(isProject)
  ) {
    throw new Error('This file is not a compatible Marden backup.');
  }

  const documentIds = new Set(parsed.documents.map((document) => document.id));
  const projectIds = new Set(parsed.projects.map((project) => project.id));
  if (documentIds.size !== parsed.documents.length || projectIds.size !== parsed.projects.length) {
    throw new Error('This backup has duplicate document or project identifiers.');
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: parsed.exportedAt,
    documents: parsed.documents.map((document) => ({ ...document })),
    projects: parsed.projects.map((project) => ({ ...project })),
  };
};

/**
 * Adds a backup without overwriting this device's library. Identical documents
 * are skipped; conflicting identifiers are assigned a new local identifier.
 */
export const mergeLibraryBackup = (
  existingDocuments: MarkdownDocument[],
  existingProjects: Project[],
  backup: MardenLibraryBackup,
): BackupMergeResult => {
  const projects = [...existingProjects];
  const projectIds = new Set(projects.map((project) => project.id));
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const projectsByName = new Map(projects.map((project) => [project.name.trim().toLocaleLowerCase(), project]));
  const projectIdMap = new Map<string, string>();
  let restoredProjectCount = 0;

  for (const project of backup.projects) {
    const matchingId = projectsById.get(project.id);
    if (matchingId) {
      if (matchingId.name === project.name && matchingId.color === project.color) {
        projectIdMap.set(project.id, matchingId.id);
        continue;
      }

      const uniqueProjectId = uniqueId(`restored-${project.id}`, projectIds);
      const restoredProject: Project = {
        ...project,
        id: uniqueProjectId,
        cloudId: undefined,
        cloudUserId: undefined,
        cloudModifiedAt: undefined,
        cloudVersion: undefined,
        syncedDeviceModifiedAt: undefined,
        deviceModifiedAt: Date.now(),
      };
      projects.push(restoredProject);
      projectsById.set(restoredProject.id, restoredProject);
      projectIdMap.set(project.id, restoredProject.id);
      restoredProjectCount += 1;
      continue;
    }

    const matchingName = projectsByName.get(project.name.trim().toLocaleLowerCase());
    if (matchingName) {
      projectIdMap.set(project.id, matchingName.id);
      continue;
    }

    const restoredProject: Project = {
      ...project,
      id: uniqueId(project.id, projectIds),
      cloudId: undefined,
      cloudUserId: undefined,
      cloudModifiedAt: undefined,
      cloudVersion: undefined,
      syncedDeviceModifiedAt: undefined,
      deviceModifiedAt: Date.now(),
    };
    projects.push(restoredProject);
    projectsById.set(restoredProject.id, restoredProject);
    projectsByName.set(restoredProject.name.trim().toLocaleLowerCase(), restoredProject);
    projectIdMap.set(project.id, restoredProject.id);
    restoredProjectCount += 1;
  }

  const documents = [...existingDocuments];
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const documentIds = new Set(documents.map((document) => document.id));
  const fileNames = new Set(documents.map((document) => document.fileName.toLocaleLowerCase()));
  let restoredDocumentCount = 0;
  let skippedDocumentCount = 0;

  for (const document of backup.documents) {
    const matchingId = documentsById.get(document.id);
    if (matchingId?.content === document.content) {
      skippedDocumentCount += 1;
      continue;
    }

    const projectId = document.projectId
      ? projectIdMap.get(document.projectId) || (projectsById.has(document.projectId) ? document.projectId : null)
      : null;
    const restoredDocument: MarkdownDocument = {
      ...document,
      id: uniqueId(matchingId ? `restored-${document.id}` : document.id, documentIds),
      title: safeDocumentName(document.title),
      fileName: uniqueFileName(document.fileName || document.title, fileNames),
      wordCount: wordCount(document.content),
      projectId,
      // Cloud IDs belong to the account that created the backup. Restored
      // records must be treated as local changes and receive fresh IDs in the
      // current account, otherwise RLS rejects them or mixes accounts.
      cloudId: undefined,
      cloudUserId: undefined,
      cloudModifiedAt: undefined,
      cloudVersion: undefined,
      syncedDeviceModifiedAt: undefined,
      deviceModifiedAt: Date.now(),
      deletedAt: undefined,
    };
    documents.push(restoredDocument);
    documentsById.set(restoredDocument.id, restoredDocument);
    restoredDocumentCount += 1;
  }

  return {
    documents,
    projects,
    restoredDocumentCount,
    restoredProjectCount,
    skippedDocumentCount,
  };
};
