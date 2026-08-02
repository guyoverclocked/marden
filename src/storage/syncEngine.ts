/**
 * Cloud sync engine — Last‑Write‑Wins (LWW) strategy.
 *
 * Single‑user, serial‑access pattern. The user edits on one device at a time.
 * When two devices edit the same doc offline, the later timestamp wins and a
 * conflict copy is created as a safety net.
 *
 * Timestamps:
 *  - `deviceModifiedAt` — device-local time of the last local edit (set by
 *    the app whenever a document/project changes).
 *  - `cloudModifiedAt` — server `modified_at` from the last successful push.
 *  - Push: a doc is pushed when `deviceModifiedAt > cloudModifiedAt` (or it
 *    has never been pushed).
 *  - Merge: remote wins when `cloud.modified_at > deviceModifiedAt`.
 */
import Storage from '@react-native-async-storage/async-storage';
import { loadLibrary, loadProjects, saveLibrary, saveProjects } from './libraryStorage';
import { supabase, isCloudConfigured } from '../supabase';
import {
  CloudDocument,
  CloudPreferences,
  CloudProject,
  CloudSyncState,
  MarkdownDocument,
  Project,
  SyncMetadata,
} from '../types';
import { wordCount } from '../utils/markdown';

const SYNC_META_KEY = 'marden.sync.meta.v1';

let syncInProgress = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
const syncStateListeners = new Set<(state: CloudSyncState) => void>();

const reportSyncState = (
  state: CloudSyncState,
  onStateChange?: (state: CloudSyncState) => void,
) => {
  onStateChange?.(state);
  syncStateListeners.forEach((listener) => listener(state));
};

// ── public API ────────────────────────────────────────────────────────────

/**
 * Trigger a full bidirectional sync. Safe to call frequently — in‑flight
 * requests are coalesced and rapid calls are debounced.
 */
export function requestSync(
  onStateChange?: (state: CloudSyncState) => void,
): void {
  if (!isCloudConfigured()) return;

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => performSync(onStateChange), 3_000);
}

/** Perform sync immediately (used on sign‑in and manual "Sync Now"). */
export async function syncNow(
  onStateChange?: (state: CloudSyncState) => void,
): Promise<void> {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  await performSync(onStateChange);
}

export function cancelPendingSync(): void {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
}

/** Subscribe to every automatic or manual sync state transition. */
export function subscribeToSyncState(listener: (state: CloudSyncState) => void): () => void {
  syncStateListeners.add(listener);
  return () => syncStateListeners.delete(listener);
}

// ── internals ─────────────────────────────────────────────────────────────

async function loadSyncMeta(): Promise<SyncMetadata | null> {
  try {
    const raw = await Storage.getItem(SYNC_META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function saveSyncMeta(meta: SyncMetadata): Promise<void> {
  await Storage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

async function performSync(
  onStateChange?: (state: CloudSyncState) => void,
): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    const session = await supabase.auth.getSession();
    if (!session.data.session) { reportSyncState('disconnected', onStateChange); return; }

    reportSyncState('pending', onStateChange);

    const userId = session.data.session.user.id;
    // Sync cursors are scoped to an account. Reusing one user's cursor for a
    // different account would skip that account's pre-existing library.
    const storedMeta = await loadSyncMeta();
    const meta = storedMeta?.userId === userId ? storedMeta : null;
    const documents = await loadLibrary();
    const projects = await loadProjects();

    // ── PUSH: upload local changes that are newer than remote ──────────
    const now = Date.now();

    let pushFailure: Error | null = null;

    // Projects must be uploaded first so documents can reference their cloud
    // UUID in the same sync pass.
    for (const project of projects) {
      const deviceModified = project.deviceModifiedAt ?? project.createdAt;
      const cloudModified = project.cloudModifiedAt ?? 0;
      if (project.cloudId && deviceModified <= cloudModified) continue;

      const { data, error } = await supabase.from('projects').upsert(
        {
          ...(project.cloudId ? { id: project.cloudId } : {}),
          user_id: userId,
          local_id: project.id,
          name: project.name,
          color: project.color,
          modified_at: new Date(now).toISOString(),
          deleted_at: null,
        },
        { onConflict: project.cloudId ? 'id' : 'user_id,local_id' },
      ).select('id, modified_at').single();

      if (error) {
        console.warn('[sync] push project failed:', error);
        pushFailure = error;
        continue;
      }

      project.cloudId = data.id;
      project.cloudModifiedAt = new Date(data.modified_at).getTime();
    }

    // Upsert documents after projects, including both the authenticated owner
    // and soft-delete tombstones. Never clear a tombstone accidentally.
    for (const doc of documents) {
      const deviceModified = doc.deviceModifiedAt ?? doc.modifiedAt;
      const cloudModified = doc.cloudModifiedAt ?? 0;
      if (doc.cloudId && deviceModified <= cloudModified) continue;

      const cloudProjectId = doc.projectId
        ? projects.find((project) => project.id === doc.projectId)?.cloudId ?? null
        : null;
      const { data, error } = await supabase.from('documents').upsert(
        {
          ...(doc.cloudId ? { id: doc.cloudId } : {}),
          user_id: userId,
          local_id: doc.id,
          title: doc.title,
          file_name: doc.fileName,
          content: doc.content,
          is_favorite: doc.isFavorite,
          reading_progress: doc.readingProgress,
          word_count: doc.wordCount,
          project_id: cloudProjectId,
          device_modified_at: new Date(deviceModified).toISOString(),
          modified_at: new Date(now).toISOString(),
          last_opened_at: new Date(doc.lastOpenedAt).toISOString(),
          deleted_at: doc.deletedAt ? new Date(doc.deletedAt).toISOString() : null,
        },
        { onConflict: doc.cloudId ? 'id' : 'user_id,local_id' },
      ).select('id, modified_at').single();

      if (error) {
        console.warn('[sync] push document failed:', error);
        pushFailure = error;
        continue;
      }

      doc.cloudId = data.id;
      doc.cloudModifiedAt = new Date(data.modified_at).getTime();
    }

    if (pushFailure) {
      throw pushFailure;
    }

    // ── PULL: download remote changes since last sync ──────────────────
    // Run after push so local edits take precedence and the pull window
    // starts after this device's changes were uploaded.
    const { data: changes, error: pullError } = await supabase
      .rpc('pull_changes_since', {
        since_timestamp: meta?.lastPullAt
          ? new Date(meta.lastPullAt).toISOString()
          : new Date(0).toISOString(),
        user_uuid: userId,
      });

    if (pullError) throw pullError;

    // ── MERGE remote changes into local ───────────────────────────────
    if (changes) {
      for (const row of changes) {
        if (row.entity_type === 'document') {
          mergeDocument(row.entity_data as CloudDocument, documents, projects);
        } else if (row.entity_type === 'project') {
          mergeProject(row.entity_data as CloudProject, projects);
        } else if (row.entity_type === 'preference') {
          mergePreferences(row.entity_data as CloudPreferences);
        }
      }
    }

    await saveLibrary(documents);
    await saveProjects(projects);
    await saveSyncMeta({
      userId,
      lastPullAt: Date.now(),
      lastPushAt: Date.now(),
    });

    reportSyncState('synced', onStateChange);
  } catch (err) {
    console.error('[sync] failed:', err);
    reportSyncState('error', onStateChange);
  } finally {
    syncInProgress = false;
  }
}

// ── merge helpers ─────────────────────────────────────────────────────────

function mergeDocument(
  cloud: CloudDocument,
  local: MarkdownDocument[],
  projects: Project[],
): void {
  const existingByCloudId = local.find((d) => d.cloudId === cloud.id);
  const existingByLocalId = cloud.local_id
    ? local.find((d) => d.id === cloud.local_id)
    : undefined;
  const existing = existingByCloudId || existingByLocalId;

  // Tombstone: remote says the doc was deleted.
  if (cloud.deleted_at) {
    if (existing) {
      const deviceModified = existing.deviceModifiedAt ?? existing.modifiedAt;
      // Local edits newer than the delete keep the doc (it will be re-pushed).
      if (deviceModified <= new Date(cloud.deleted_at).getTime()) {
        const index = local.indexOf(existing);
        if (index !== -1) local.splice(index, 1);
      } else if (!existing.cloudId) {
        existing.cloudId = cloud.id;
        existing.cloudModifiedAt = new Date(cloud.deleted_at).getTime();
      }
    }
    return;
  }

  if (!existing) {
    local.push({
      id: cloud.local_id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      cloudId: cloud.id,
      title: cloud.title,
      fileName: cloud.file_name,
      content: cloud.content,
      createdAt: new Date(cloud.created_at).getTime(),
      modifiedAt: new Date(cloud.modified_at).getTime(),
      lastOpenedAt: new Date(cloud.last_opened_at).getTime(),
      isFavorite: cloud.is_favorite,
      readingProgress: cloud.reading_progress,
      wordCount: cloud.word_count,
      projectId: cloud.project_id
        ? projects.find((project) => project.cloudId === cloud.project_id)?.id ?? null
        : null,
      cloudModifiedAt: new Date(cloud.modified_at).getTime(),
      deviceModifiedAt: cloud.device_modified_at
        ? new Date(cloud.device_modified_at).getTime()
        : new Date(cloud.modified_at).getTime(),
    });
    return;
  }

  const cloudModified = new Date(cloud.modified_at).getTime();
  const deviceModified = existing.deviceModifiedAt ?? existing.modifiedAt;

  if (cloudModified > deviceModified) {
    // Remote is newer — remote wins. Keep the local edit as a conflict copy
    // so no work is silently lost.
    const localHasUnsyncedEdit = deviceModified > (existing.cloudModifiedAt ?? 0);
    if (localHasUnsyncedEdit) {
      local.push({
        ...existing,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        cloudId: undefined,
        cloudModifiedAt: undefined,
        deviceModifiedAt: deviceModified,
        title: `${existing.title} (conflict from Device)`,
        fileName: conflictFileName(existing.fileName),
      });
    }

    existing.title = cloud.title;
    existing.fileName = cloud.file_name;
    existing.content = cloud.content;
    existing.isFavorite = cloud.is_favorite;
    existing.readingProgress = cloud.reading_progress;
    existing.wordCount = cloud.word_count;
    existing.projectId = cloud.project_id
      ? projects.find((project) => project.cloudId === cloud.project_id)?.id ?? null
      : null;
    existing.deletedAt = undefined;
    existing.modifiedAt = cloudModified;
    existing.lastOpenedAt = new Date(cloud.last_opened_at).getTime();
    existing.cloudModifiedAt = cloudModified;
    existing.deviceModifiedAt = cloud.device_modified_at
      ? new Date(cloud.device_modified_at).getTime()
      : cloudModified;
  }

  existing.cloudId = cloud.id;
  if (!existing.cloudModifiedAt || cloudModified > existing.cloudModifiedAt) {
    existing.cloudModifiedAt = cloudModified;
  }
}

function conflictFileName(fileName: string): string {
  const match = fileName.match(/^(.*?)(\.[^.]+)?$/);
  const base = match?.[1] || fileName;
  const ext = match?.[2] || '.md';
  return `${base} (conflict from Device)${ext}`;
}

function mergeProject(cloud: CloudProject, local: Project[]): void {
  const existingByCloudId = local.find((p) => p.cloudId === cloud.id);
  const existingByLocalId = cloud.local_id
    ? local.find((p) => p.id === cloud.local_id)
    : undefined;
  const existing = existingByCloudId || existingByLocalId;

  if (cloud.deleted_at) {
    if (existing) {
      const deviceModified = existing.deviceModifiedAt ?? existing.createdAt;
      if (deviceModified <= new Date(cloud.deleted_at).getTime()) {
        const index = local.indexOf(existing);
        if (index !== -1) local.splice(index, 1);
      } else if (!existing.cloudId) {
        existing.cloudId = cloud.id;
      }
    }
    return;
  }

  if (!existing) {
    local.push({
      id: cloud.local_id || `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cloud.name,
      color: cloud.color,
      createdAt: new Date(cloud.created_at).getTime(),
      cloudId: cloud.id,
      deviceModifiedAt: cloud.modified_at
        ? new Date(cloud.modified_at).getTime()
        : new Date(cloud.created_at).getTime(),
      cloudModifiedAt: cloud.modified_at
        ? new Date(cloud.modified_at).getTime()
        : new Date(cloud.created_at).getTime(),
    });
    return;
  }

  const cloudModified = cloud.modified_at
    ? new Date(cloud.modified_at).getTime()
    : new Date(cloud.created_at).getTime();
  const deviceModified = existing.deviceModifiedAt ?? existing.createdAt;
  if (cloudModified > deviceModified) {
    existing.name = cloud.name;
    existing.color = cloud.color;
    existing.deviceModifiedAt = cloudModified;
  }
  existing.cloudId = cloud.id;
  existing.cloudModifiedAt = Math.max(existing.cloudModifiedAt ?? 0, cloudModified);
}

function mergePreferences(cloud: CloudPreferences): void {
  void Storage.setItem('marden.reader.dark.v1', String(cloud.dark_mode));
  void Storage.setItem('marden.reader.scale.v1', cloud.text_scale);
}
