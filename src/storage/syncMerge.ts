import {
  CloudDocument,
  CloudProject,
  MarkdownDocument,
  Project,
} from '../types';

export type SyncLibrarySnapshot = {
  documents: MarkdownDocument[];
  projects: Project[];
};

export type SyncLibraryUpdate = {
  base: SyncLibrarySnapshot;
  synced: SyncLibrarySnapshot;
};

const timestamp = (value: string | null | undefined, fallback = Date.now()) => {
  if (!value) return fallback;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nextLocalId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const conflictFileName = (fileName: string): string => {
  const match = fileName.match(/^(.*?)(\.[^.]+)?$/);
  const base = match?.[1] || fileName;
  const ext = match?.[2] || '.md';
  return `${base} (conflict from Device)${ext}`;
};

const projectForCloudId = (projects: Project[], cloudId: string | null) =>
  cloudId ? projects.find((project) => project.cloudId === cloudId)?.id ?? null : null;

export const cloneSyncSnapshot = (snapshot: SyncLibrarySnapshot): SyncLibrarySnapshot => ({
  documents: snapshot.documents.map((document) => ({ ...document })),
  projects: snapshot.projects.map((project) => ({ ...project })),
});

export const isDocumentDirty = (document: MarkdownDocument): boolean => {
  if (!document.cloudId) return true;
  const deviceModified = document.deviceModifiedAt ?? document.modifiedAt;
  if (document.syncedDeviceModifiedAt !== undefined) {
    return deviceModified !== document.syncedDeviceModifiedAt;
  }

  // Migration path for v2.0.x records. New syncs always persist an explicit
  // acknowledged device timestamp, so correctness no longer depends on this
  // comparison between a device clock and a server timestamp.
  return deviceModified > (document.cloudModifiedAt ?? 0);
};

export const isProjectDirty = (project: Project): boolean => {
  if (!project.cloudId) return true;
  const deviceModified = project.deviceModifiedAt ?? project.createdAt;
  if (project.syncedDeviceModifiedAt !== undefined) {
    return deviceModified !== project.syncedDeviceModifiedAt;
  }
  return deviceModified > (project.cloudModifiedAt ?? 0);
};

const remoteVersionChanged = (
  cloudVersion: string | undefined,
  cloudModifiedAt: number | undefined,
  remoteVersion: string,
) => {
  if (cloudVersion) return cloudVersion !== remoteVersion;
  if (cloudModifiedAt !== undefined) return cloudModifiedAt !== timestamp(remoteVersion);
  return true;
};

const clearDocumentCloudMetadata = (document: MarkdownDocument) => {
  document.cloudId = undefined;
  document.cloudUserId = undefined;
  document.cloudModifiedAt = undefined;
  document.cloudVersion = undefined;
  document.syncedDeviceModifiedAt = undefined;
};

const clearProjectCloudMetadata = (project: Project) => {
  project.cloudId = undefined;
  project.cloudUserId = undefined;
  project.cloudModifiedAt = undefined;
  project.cloudVersion = undefined;
  project.syncedDeviceModifiedAt = undefined;
};

const applyCloudProject = (local: Project, cloud: CloudProject, userId: string) => {
  const cloudModified = timestamp(cloud.modified_at, timestamp(cloud.created_at));
  local.cloudId = cloud.id;
  local.cloudUserId = userId;
  local.name = cloud.name;
  local.color = cloud.color;
  local.createdAt = timestamp(cloud.created_at, local.createdAt);
  local.deviceModifiedAt = cloudModified;
  local.syncedDeviceModifiedAt = cloudModified;
  local.cloudModifiedAt = cloudModified;
  local.cloudVersion = cloud.modified_at ?? cloud.created_at;
};

const projectMatchesCloud = (local: Project, cloud: CloudProject) =>
  local.name === cloud.name && local.color === cloud.color;

export const mergeCloudProjects = (
  cloudProjects: CloudProject[],
  projects: Project[],
  userId: string,
): void => {
  const remoteIds = new Set(cloudProjects.map((project) => project.id));

  for (const cloud of cloudProjects) {
    const existing = projects.find((project) => project.cloudId === cloud.id)
      ?? (cloud.local_id ? projects.find((project) => project.id === cloud.local_id) : undefined);

    if (cloud.deleted_at) {
      if (!existing) continue;
      if (isProjectDirty(existing) && remoteVersionChanged(
        existing.cloudVersion,
        existing.cloudModifiedAt,
        cloud.modified_at ?? cloud.deleted_at,
      )) {
        // A local rename raced a remote delete. Preserve the local project by
        // resurrecting it on the next push instead of silently discarding it.
        existing.cloudId = cloud.id;
        existing.cloudUserId = userId;
        existing.cloudVersion = cloud.modified_at ?? cloud.deleted_at;
        existing.cloudModifiedAt = timestamp(existing.cloudVersion);
      } else {
        projects.splice(projects.indexOf(existing), 1);
      }
      continue;
    }

    if (!existing) {
      const project: Project = {
        id: cloud.local_id || nextLocalId('project'),
        name: cloud.name,
        color: cloud.color,
        createdAt: timestamp(cloud.created_at),
      };
      applyCloudProject(project, cloud, userId);
      projects.push(project);
      continue;
    }

    // A deterministic seed/local record (such as a restored backup) may have
    // the same local_id without cloud metadata. Adopt the cloud row when its
    // user-visible data is identical.
    if (projectMatchesCloud(existing, cloud)) {
      applyCloudProject(existing, cloud, userId);
      continue;
    }

    const localDirty = isProjectDirty(existing);
    const remoteChanged = remoteVersionChanged(
      existing.cloudVersion,
      existing.cloudModifiedAt,
      cloud.modified_at ?? cloud.created_at,
    );

    if (localDirty && remoteChanged) {
      projects.push({
        ...existing,
        id: nextLocalId('project-conflict'),
        name: `${existing.name} (conflict from Device)`,
        cloudId: undefined,
        cloudUserId: undefined,
        cloudModifiedAt: undefined,
        cloudVersion: undefined,
        syncedDeviceModifiedAt: undefined,
      });
      applyCloudProject(existing, cloud, userId);
    } else if (!localDirty) {
      applyCloudProject(existing, cloud, userId);
    } else {
      existing.cloudId = cloud.id;
      existing.cloudUserId = userId;
      existing.cloudVersion = cloud.modified_at ?? cloud.created_at;
      existing.cloudModifiedAt = timestamp(existing.cloudVersion);
    }
  }

  // A cloud ID from another account (or a hard-deleted legacy row) must never
  // be updated under the current account. Treat that local project as new.
  for (const project of projects) {
    if (project.cloudId && !remoteIds.has(project.cloudId) && project.cloudUserId !== userId) {
      clearProjectCloudMetadata(project);
    }
  }
};

const applyCloudDocument = (
  local: MarkdownDocument,
  cloud: CloudDocument,
  projects: Project[],
  userId: string,
) => {
  const cloudModified = timestamp(cloud.modified_at);
  const deviceModified = timestamp(cloud.device_modified_at, cloudModified);
  local.cloudId = cloud.id;
  local.cloudUserId = userId;
  local.title = cloud.title;
  local.fileName = cloud.file_name;
  local.content = cloud.content;
  local.createdAt = timestamp(cloud.created_at, local.createdAt);
  local.modifiedAt = cloudModified;
  local.lastOpenedAt = Math.max(
    local.lastOpenedAt ?? 0,
    timestamp(cloud.last_opened_at, cloudModified),
  );
  local.isFavorite = cloud.is_favorite;
  local.readingProgress = cloud.reading_progress;
  local.wordCount = cloud.word_count;
  local.projectId = projectForCloudId(projects, cloud.project_id);
  local.deletedAt = undefined;
  local.deviceModifiedAt = deviceModified;
  local.syncedDeviceModifiedAt = deviceModified;
  local.cloudModifiedAt = cloudModified;
  local.cloudVersion = cloud.modified_at;
};

const documentMatchesCloud = (
  local: MarkdownDocument,
  cloud: CloudDocument,
  projects: Project[],
) => local.title === cloud.title
  && local.fileName === cloud.file_name
  && local.content === cloud.content
  && local.isFavorite === cloud.is_favorite
  && local.readingProgress === cloud.reading_progress
  && local.wordCount === cloud.word_count
  && local.projectId === projectForCloudId(projects, cloud.project_id)
  && !local.deletedAt;

const documentBodyMatchesCloud = (local: MarkdownDocument, cloud: CloudDocument) =>
  local.title === cloud.title
  && local.fileName === cloud.file_name
  && local.content === cloud.content
  && local.wordCount === cloud.word_count;

const conflictDocument = (document: MarkdownDocument): MarkdownDocument => ({
  ...document,
  id: nextLocalId('document-conflict'),
  title: `${document.title} (conflict from Device)`,
  fileName: conflictFileName(document.fileName),
  deletedAt: undefined,
  cloudId: undefined,
  cloudUserId: undefined,
  cloudModifiedAt: undefined,
  cloudVersion: undefined,
  syncedDeviceModifiedAt: undefined,
});

export const mergeCloudDocuments = (
  cloudDocuments: CloudDocument[],
  documents: MarkdownDocument[],
  projects: Project[],
  userId: string,
): void => {
  const remoteIds = new Set(cloudDocuments.map((document) => document.id));

  for (const cloud of cloudDocuments) {
    const existing = documents.find((document) => document.cloudId === cloud.id)
      ?? (cloud.local_id ? documents.find((document) => document.id === cloud.local_id) : undefined);

    if (cloud.deleted_at) {
      if (!existing) continue;
      const localDirty = isDocumentDirty(existing);
      const remoteChanged = remoteVersionChanged(
        existing.cloudVersion,
        existing.cloudModifiedAt,
        cloud.modified_at,
      );

      if (localDirty && remoteChanged && !existing.deletedAt) {
        documents.push(conflictDocument(existing));
      }
      documents.splice(documents.indexOf(existing), 1);
      continue;
    }

    if (!existing) {
      const document: MarkdownDocument = {
        id: cloud.local_id || nextLocalId('document'),
        title: cloud.title,
        fileName: cloud.file_name,
        content: cloud.content,
        createdAt: timestamp(cloud.created_at),
        modifiedAt: timestamp(cloud.modified_at),
        lastOpenedAt: timestamp(cloud.last_opened_at, timestamp(cloud.modified_at)),
        isFavorite: cloud.is_favorite,
        readingProgress: cloud.reading_progress,
        wordCount: cloud.word_count,
        projectId: projectForCloudId(projects, cloud.project_id),
      };
      applyCloudDocument(document, cloud, projects, userId);
      documents.push(document);
      continue;
    }

    if (documentMatchesCloud(existing, cloud, projects)) {
      applyCloudDocument(existing, cloud, projects, userId);
      continue;
    }

    const localDirty = isDocumentDirty(existing);
    const remoteChanged = remoteVersionChanged(
      existing.cloudVersion,
      existing.cloudModifiedAt,
      cloud.modified_at,
    );

    if (localDirty && remoteChanged) {
      if (!existing.deletedAt && documentBodyMatchesCloud(existing, cloud)) {
        // Metadata-only changes (progress, favourite, project) can be safely
        // replayed on top of the new remote version without duplicating the
        // document body as a conflict copy.
        existing.cloudId = cloud.id;
        existing.cloudUserId = userId;
        existing.cloudVersion = cloud.modified_at;
        existing.cloudModifiedAt = timestamp(cloud.modified_at);
        continue;
      }
      // Remote remains canonical and the unsynced local body becomes a normal
      // document that will be uploaded in this same pass. Both edits survive.
      if (!existing.deletedAt) documents.push(conflictDocument(existing));
      applyCloudDocument(existing, cloud, projects, userId);
    } else if (!localDirty) {
      applyCloudDocument(existing, cloud, projects, userId);
    } else {
      existing.cloudId = cloud.id;
      existing.cloudUserId = userId;
      existing.cloudVersion = cloud.modified_at;
      existing.cloudModifiedAt = timestamp(cloud.modified_at);
    }
  }

  for (const document of [...documents]) {
    if (document.cloudId && !remoteIds.has(document.cloudId) && document.cloudUserId !== userId) {
      if (document.deletedAt) {
        documents.splice(documents.indexOf(document), 1);
      } else {
        clearDocumentCloudMetadata(document);
      }
    }
  }
};

const sameValue = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

const documentWithAcknowledgement = (
  current: MarkdownDocument,
  synced: MarkdownDocument,
): MarkdownDocument => ({
  ...current,
  cloudId: synced.cloudId,
  cloudUserId: synced.cloudUserId,
  cloudModifiedAt: synced.cloudModifiedAt,
  cloudVersion: synced.cloudVersion,
  syncedDeviceModifiedAt: synced.syncedDeviceModifiedAt,
});

const projectWithAcknowledgement = (current: Project, synced: Project): Project => ({
  ...current,
  cloudId: synced.cloudId,
  cloudUserId: synced.cloudUserId,
  cloudModifiedAt: synced.cloudModifiedAt,
  cloudVersion: synced.cloudVersion,
  syncedDeviceModifiedAt: synced.syncedDeviceModifiedAt,
});

/**
 * Apply a completed sync without dropping edits made after that sync began.
 * The returned arrays reuse the current references when nothing changed, which
 * also prevents a successful sync from scheduling itself forever in React.
 */
export const reconcileLiveLibrary = (
  update: SyncLibraryUpdate,
  current: SyncLibrarySnapshot,
): SyncLibrarySnapshot => {
  const baseDocuments = new Map(update.base.documents.map((document) => [document.id, document]));
  const syncedDocuments = new Map(update.synced.documents.map((document) => [document.id, document]));
  const seenDocuments = new Set<string>();
  const nextDocuments: MarkdownDocument[] = [];

  for (const document of current.documents) {
    const base = baseDocuments.get(document.id);
    const synced = syncedDocuments.get(document.id);
    if (!synced) {
      if (!base || !sameValue(document, base)) nextDocuments.push(document);
      continue;
    }

    seenDocuments.add(document.id);
    if (base && !sameValue(document, base)) {
      nextDocuments.push(documentWithAcknowledgement(document, synced));
    } else {
      nextDocuments.push(sameValue(document, synced) ? document : synced);
    }
  }

  for (const document of update.synced.documents) {
    if (!seenDocuments.has(document.id)) nextDocuments.push(document);
  }

  const baseProjects = new Map(update.base.projects.map((project) => [project.id, project]));
  const syncedProjects = new Map(update.synced.projects.map((project) => [project.id, project]));
  const seenProjects = new Set<string>();
  const nextProjects: Project[] = [];

  for (const project of current.projects) {
    const base = baseProjects.get(project.id);
    const synced = syncedProjects.get(project.id);
    if (!synced) {
      if (!base || !sameValue(project, base)) nextProjects.push(project);
      continue;
    }

    seenProjects.add(project.id);
    if (base && !sameValue(project, base)) {
      nextProjects.push(projectWithAcknowledgement(project, synced));
    } else {
      nextProjects.push(sameValue(project, synced) ? project : synced);
    }
  }

  for (const project of update.synced.projects) {
    if (!seenProjects.has(project.id)) nextProjects.push(project);
  }

  return {
    documents: sameValue(nextDocuments, current.documents) ? current.documents : nextDocuments,
    projects: sameValue(nextProjects, current.projects) ? current.projects : nextProjects,
  };
};
