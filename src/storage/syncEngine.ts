/**
 * Durable, bidirectional cloud sync.
 *
 * Correctness rules:
 *  - Pull a complete account snapshot before pushing, so a stale device never
 *    blindly overwrites a change it has not seen.
 *  - Never use a device clock as a remote cursor. Full, paginated snapshots
 *    make clock skew and interrupted cursor writes harmless.
 *  - Keep exact server versions for optimistic updates. Concurrent edits are
 *    reconciled on an immediate second pass and losing document bodies become
 *    normal conflict copies, so content is not silently discarded.
 *  - Retry only transient failures. A partial push is persisted locally with
 *    its successful acknowledgements, but is reported as an error and never as
 *    "synced" until every row succeeds.
 *  - Publish the reconciled snapshot to the running app as well as storage.
 */
import Storage from '@react-native-async-storage/async-storage';
import { loadLibrary, loadProjects, saveLibrary, saveProjects } from './libraryStorage';
import { supabase, isCloudConfigured } from '../supabase';
import {
  CloudDocument,
  CloudProject,
  CloudSyncState,
  MarkdownDocument,
  Project,
  SyncMetadata,
} from '../types';
import {
  cloneSyncSnapshot,
  isDocumentDirty,
  isProjectDirty,
  mergeCloudDocuments,
  mergeCloudProjects,
  SyncLibrarySnapshot,
  SyncLibraryUpdate,
} from './syncMerge';
import { isTransientSyncError, runSyncQuery } from './syncNetwork';

const SYNC_META_KEY = 'marden.sync.meta.v1';
const AUTO_SYNC_DELAY_MS = 1_500;
const PAGE_SIZE = 100;
const CONTENT_BATCH_SIZE = 10;
const MAX_IMMEDIATE_PASSES = 3;
const RETRY_BASE_DELAY_MS = 15_000;
const RETRY_MAX_DELAY_MS = 5 * 60_000;

type SyncLibraryAdapter = {
  read: () => SyncLibrarySnapshot | null;
  apply: (update: SyncLibraryUpdate) => SyncLibrarySnapshot;
};

type CloudDocumentManifest = Omit<CloudDocument, 'content'>;

const DOCUMENT_MANIFEST_COLUMNS = 'id,user_id,title,file_name,created_at,modified_at,last_opened_at,is_favorite,reading_progress,word_count,project_id,local_id,device_modified_at,deleted_at';

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let activeSync: Promise<void> | null = null;
let rerunRequested = false;
let transientFailureCount = 0;
let syncEpoch = 0;
let libraryAdapter: SyncLibraryAdapter | null = null;
const syncStateListeners = new Set<(state: CloudSyncState) => void>();
const activeCallListeners = new Set<(state: CloudSyncState) => void>();

const reportSyncState = (state: CloudSyncState) => {
  syncStateListeners.forEach((listener) => listener(state));
  activeCallListeners.forEach((listener) => listener(state));
};

/** Connect cloud reconciliation to the currently rendered library. */
export function registerSyncLibraryAdapter(adapter: SyncLibraryAdapter): () => void {
  libraryAdapter = adapter;
  return () => {
    if (libraryAdapter === adapter) libraryAdapter = null;
  };
}

/**
 * Debounced automatic sync for local edits. Calls made during a network pass
 * request another pass, ensuring edits made in flight are not left pending.
 */
export function requestSync(onStateChange?: (state: CloudSyncState) => void): void {
  if (!isCloudConfigured()) return;
  clearAutomaticRetry();
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void startSync(onStateChange);
  }, AUTO_SYNC_DELAY_MS);
}

/** Perform and await sync immediately (launch, sign-in, foreground, or manual). */
export async function syncNow(
  onStateChange?: (state: CloudSyncState) => void,
): Promise<void> {
  clearAutomaticRetry();
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  await startSync(onStateChange);
}

export function cancelPendingSync(): void {
  // In-flight requests cannot always be cancelled by the platform fetch
  // implementation. Invalidating their epoch guarantees their cloned result
  // is never applied after sign-out or an account switch.
  syncEpoch += 1;
  rerunRequested = false;
  clearAutomaticRetry(true);
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

export function subscribeToSyncState(listener: (state: CloudSyncState) => void): () => void {
  syncStateListeners.add(listener);
  return () => syncStateListeners.delete(listener);
}

async function startSync(onStateChange?: (state: CloudSyncState) => void): Promise<void> {
  if (onStateChange) activeCallListeners.add(onStateChange);

  try {
    if (activeSync) {
      rerunRequested = true;
      await activeSync;
      // An account switch can invalidate the active pass before it consumes
      // the rerun request. Start a fresh pass for the newly signed-in account.
      if (rerunRequested && !activeSync) await startSync(onStateChange);
      return;
    }

    const run = runSyncLoop(syncEpoch);
    const trackedRun = run.finally(() => {
      if (activeSync === trackedRun) activeSync = null;
    });
    activeSync = trackedRun;
    await activeSync;
  } finally {
    if (onStateChange) activeCallListeners.delete(onStateChange);
  }
}

class SyncCancelledError extends Error {}

const assertSyncEpoch = (expectedEpoch: number) => {
  if (syncEpoch !== expectedEpoch) throw new SyncCancelledError('Sync was cancelled');
};

async function runSyncLoop(expectedEpoch: number): Promise<void> {
  reportSyncState('pending');

  try {
    let pass = 0;
    let accountAvailable = true;
    do {
      rerunRequested = false;
      pass += 1;
      const result = await performSyncPass(expectedEpoch);
      if (result === 'disconnected') {
        accountAvailable = false;
        break;
      }
      if (result === 'concurrent') rerunRequested = true;
    } while (rerunRequested && pass < MAX_IMMEDIATE_PASSES);

    if (!accountAvailable) {
      reportSyncState('disconnected');
    } else if (rerunRequested) {
      throw new Error('Cloud data kept changing during sync; retrying later');
    } else {
      transientFailureCount = 0;
      clearAutomaticRetry();
      reportSyncState('synced');
    }
  } catch (error) {
    if (error instanceof SyncCancelledError) {
      reportSyncState('disconnected');
      return;
    }
    console.error('[sync] failed:', error);
    reportSyncState('error');
    if (isTransientSyncError(error)) scheduleAutomaticRetry();
  }
}

async function performSyncPass(
  expectedEpoch: number,
): Promise<'complete' | 'concurrent' | 'disconnected'> {
  assertSyncEpoch(expectedEpoch);
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return 'disconnected';

  const userId = sessionData.session.user.id;
  const base = await readCurrentLibrary();
  const working = cloneSyncSnapshot(base);

  // Pull both tables completely. Reads can run together, but projects are
  // merged first so every downloaded document can resolve its project ID.
  const [cloudProjects, documentSnapshot] = await Promise.all([
    pullAllRows<CloudProject>('projects', userId),
    pullDocuments(userId, working.documents),
  ]);
  assertSyncEpoch(expectedEpoch);

  mergeCloudProjects(cloudProjects, working.projects, userId);
  mergeCloudDocuments(documentSnapshot.documents, working.documents, working.projects, userId);

  const failures: unknown[] = [];
  let concurrentChange = documentSnapshot.changedDuringPull;
  let networkUnavailable = false;

  // Projects first: documents uploaded in this pass can safely reference the
  // project's newly assigned cloud UUID.
  for (const project of working.projects) {
    assertSyncEpoch(expectedEpoch);
    if (!isProjectDirty(project)) continue;
    try {
      const outcome = await pushProject(project, userId);
      if (outcome === 'concurrent') concurrentChange = true;
    } catch (error) {
      failures.push(error);
      console.warn('[sync] push project failed:', error);
      if (isTransientSyncError(error)) {
        networkUnavailable = true;
        break;
      }
    }
  }

  for (const document of networkUnavailable ? [] : [...working.documents]) {
    assertSyncEpoch(expectedEpoch);
    if (!isDocumentDirty(document)) continue;
    if (document.deletedAt && !document.cloudId) {
      // A document deleted before its first upload needs no remote tombstone.
      working.documents.splice(working.documents.indexOf(document), 1);
      continue;
    }

    const assignedProject = document.projectId
      ? working.projects.find((project) => project.id === document.projectId)
      : null;
    if (document.projectId && !assignedProject?.cloudId) {
      failures.push(new Error(`Project for ${document.fileName} has not uploaded yet`));
      continue;
    }

    try {
      const outcome = await pushDocument(document, working.projects, userId);
      if (outcome === 'concurrent') {
        concurrentChange = true;
      } else if (document.deletedAt) {
        working.documents.splice(working.documents.indexOf(document), 1);
      }
    } catch (error) {
      failures.push(error);
      console.warn('[sync] push document failed:', error);
      if (isTransientSyncError(error)) {
        networkUnavailable = true;
        break;
      }
    }
  }

  // Apply and persist even after a partial push so successful acknowledgements
  // and downloaded files survive a crash. The final state remains "error" and
  // failed dirty rows are retried on the next automatic pass.
  assertSyncEpoch(expectedEpoch);
  const persisted = applyToLiveLibrary(base, working);
  await Promise.all([saveLibrary(persisted.documents), saveProjects(persisted.projects)]);

  const previousMeta = await loadSyncMeta();
  const previousPushAt = previousMeta?.userId === userId ? previousMeta.lastPushAt : null;
  await saveSyncMeta({
    userId,
    lastPullAt: Date.now(),
    lastPushAt: failures.length === 0 ? Date.now() : previousPushAt,
  });

  if (failures.length > 0) {
    if (networkUnavailable) throw failures[0];
    throw new Error(`${failures.length} cloud ${failures.length === 1 ? 'operation' : 'operations'} failed after retries`);
  }

  return concurrentChange ? 'concurrent' : 'complete';
}

async function readCurrentLibrary(): Promise<SyncLibrarySnapshot> {
  try {
    const live = libraryAdapter?.read();
    if (live) return cloneSyncSnapshot(live);
  } catch (error) {
    console.warn('[sync] could not read live library; using durable storage:', error);
  }

  const [documents, projects] = await Promise.all([loadLibrary(), loadProjects()]);
  return cloneSyncSnapshot({ documents, projects });
}

function applyToLiveLibrary(
  base: SyncLibrarySnapshot,
  working: SyncLibrarySnapshot,
): SyncLibrarySnapshot {
  const synced = cloneSyncSnapshot(working);
  if (!libraryAdapter) return synced;

  try {
    return libraryAdapter.apply({ base, synced });
  } catch (error) {
    console.warn('[sync] could not update live library; durable copy will be used:', error);
    return synced;
  }
}

async function pullAllRows<T>(table: 'documents' | 'projects', userId: string): Promise<T[]> {
  const rows: T[] = [];
  let lastId: string | null = null;
  for (;;) {
    const page = await runSyncQuery<T[]>(`pull ${table}`, (signal) => {
      let query = supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .limit(PAGE_SIZE);
      if (lastId) query = query.gt('id', lastId);
      return query.abortSignal(signal);
    });
    const result = page ?? [];
    rows.push(...result);
    if (result.length < PAGE_SIZE) break;
    lastId = (result[result.length - 1] as { id: string }).id;
  }
  return rows;
}

async function pullDocuments(
  userId: string,
  localDocuments: MarkdownDocument[],
): Promise<{ documents: CloudDocument[]; changedDuringPull: boolean }> {
  const manifests = await pullManifestRows(userId);
  const contentIds: string[] = [];

  for (const manifest of manifests) {
    if (manifest.deleted_at) continue;
    const local = localDocuments.find((document) => document.cloudId === manifest.id)
      ?? (manifest.local_id
        ? localDocuments.find((document) => document.id === manifest.local_id)
        : undefined);
    const remoteUnchanged = local
      ? local.cloudVersion
        ? local.cloudVersion === manifest.modified_at
        : local.cloudModifiedAt === new Date(manifest.modified_at).getTime()
      : false;

    if (!local || isDocumentDirty(local) || !remoteUnchanged) contentIds.push(manifest.id);
  }

  const fullRows = new Map<string, CloudDocument>();
  for (let index = 0; index < contentIds.length; index += CONTENT_BATCH_SIZE) {
    const ids = contentIds.slice(index, index + CONTENT_BATCH_SIZE);
    const rows = await runSyncQuery<CloudDocument[]>('pull document bodies', (signal) =>
      supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .in('id', ids)
        .order('id', { ascending: true })
        .abortSignal(signal),
    );
    for (const row of rows ?? []) fullRows.set(row.id, row);
  }

  const contentIdSet = new Set(contentIds);
  let changedDuringPull = false;
  const documents: CloudDocument[] = [];
  for (const manifest of manifests) {
    const local = localDocuments.find((document) => document.cloudId === manifest.id)
      ?? (manifest.local_id
        ? localDocuments.find((document) => document.id === manifest.local_id)
        : undefined);
    const full = fullRows.get(manifest.id);
    if (contentIdSet.has(manifest.id) && !manifest.deleted_at && !full) {
      // The row changed or was deleted between the manifest and body queries.
      // An immediate second pass will observe a coherent current version.
      changedDuringPull = true;
      continue;
    }
    documents.push(full ?? { ...manifest, content: local?.content ?? '' });
  }

  return { documents, changedDuringPull };
}

async function pullManifestRows(userId: string): Promise<CloudDocumentManifest[]> {
  const rows: CloudDocumentManifest[] = [];
  let lastId: string | null = null;
  for (;;) {
    const page = await runSyncQuery<CloudDocumentManifest[]>('pull document manifest', (signal) => {
      let query = supabase
        .from('documents')
        .select(DOCUMENT_MANIFEST_COLUMNS)
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .limit(PAGE_SIZE);
      if (lastId) query = query.gt('id', lastId);
      return query.abortSignal(signal);
    });
    const result = page ?? [];
    rows.push(...result);
    if (result.length < PAGE_SIZE) break;
    lastId = result[result.length - 1].id;
  }
  return rows;
}

async function pushProject(
  project: Project,
  userId: string,
): Promise<'pushed' | 'concurrent'> {
  const deviceModified = safeMillis(project.deviceModifiedAt, safeMillis(project.createdAt));
  const nextVersion = new Date().toISOString();
  const values = {
    user_id: userId,
    local_id: project.id,
    name: project.name,
    color: project.color,
    modified_at: nextVersion,
    deleted_at: null,
  };

  let data: { id: string; modified_at: string } | null;
  if (project.cloudId && project.cloudVersion) {
    data = await runSyncQuery<{ id: string; modified_at: string }>('update project', (signal) =>
      supabase
        .from('projects')
        .update(values)
        .eq('id', project.cloudId!)
        .eq('user_id', userId)
        .eq('modified_at', project.cloudVersion!)
        .select('id, modified_at')
        .abortSignal(signal)
        .maybeSingle(),
    );
    if (!data) return 'concurrent';
  } else {
    data = await runSyncQuery<{ id: string; modified_at: string }>('insert project', (signal) =>
      supabase
        .from('projects')
        .upsert(values, { onConflict: 'user_id,local_id' })
        .select('id, modified_at')
        .abortSignal(signal)
        .single(),
    );
  }

  if (!data) throw new Error('Project upload returned no acknowledgement');
  project.cloudId = data.id;
  project.cloudUserId = userId;
  project.cloudVersion = data.modified_at;
  project.cloudModifiedAt = new Date(data.modified_at).getTime();
  project.syncedDeviceModifiedAt = deviceModified;
  return 'pushed';
}

async function pushDocument(
  document: MarkdownDocument,
  projects: Project[],
  userId: string,
): Promise<'pushed' | 'concurrent'> {
  const deviceModified = safeMillis(document.deviceModifiedAt, safeMillis(document.modifiedAt));
  const nextVersion = new Date().toISOString();
  const cloudProjectId = document.projectId
    ? projects.find((project) => project.id === document.projectId)?.cloudId ?? null
    : null;
  const values = {
    user_id: userId,
    local_id: document.id,
    title: document.title,
    file_name: document.fileName,
    content: document.content,
    is_favorite: document.isFavorite,
    reading_progress: document.readingProgress,
    word_count: document.wordCount,
    project_id: cloudProjectId,
    device_modified_at: new Date(deviceModified).toISOString(),
    modified_at: nextVersion,
    last_opened_at: new Date(safeMillis(document.lastOpenedAt, deviceModified)).toISOString(),
    deleted_at: document.deletedAt
      ? new Date(safeMillis(document.deletedAt, deviceModified)).toISOString()
      : null,
  };

  let data: { id: string; modified_at: string } | null;
  if (document.cloudId && document.cloudVersion) {
    data = await runSyncQuery<{ id: string; modified_at: string }>('update document', (signal) =>
      supabase
        .from('documents')
        .update(values)
        .eq('id', document.cloudId!)
        .eq('user_id', userId)
        .eq('modified_at', document.cloudVersion!)
        .select('id, modified_at')
        .abortSignal(signal)
        .maybeSingle(),
    );
    if (!data) return 'concurrent';
  } else {
    data = await runSyncQuery<{ id: string; modified_at: string }>('insert document', (signal) =>
      supabase
        .from('documents')
        .upsert(values, { onConflict: 'user_id,local_id' })
        .select('id, modified_at')
        .abortSignal(signal)
        .single(),
    );
  }

  if (!data) throw new Error('Document upload returned no acknowledgement');
  document.cloudId = data.id;
  document.cloudUserId = userId;
  document.cloudVersion = data.modified_at;
  document.cloudModifiedAt = new Date(data.modified_at).getTime();
  document.syncedDeviceModifiedAt = deviceModified;
  return 'pushed';
}

async function loadSyncMeta(): Promise<SyncMetadata | null> {
  try {
    const raw = await Storage.getItem(SYNC_META_KEY);
    return raw ? JSON.parse(raw) as SyncMetadata : null;
  } catch {
    return null;
  }
}

async function saveSyncMeta(meta: SyncMetadata): Promise<void> {
  await Storage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

const safeMillis = (value: number | undefined, fallback = Date.now()) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function clearAutomaticRetry(resetFailureCount = false): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (resetFailureCount) transientFailureCount = 0;
}

function scheduleAutomaticRetry(): void {
  clearAutomaticRetry();
  transientFailureCount += 1;
  const exponentialDelay = Math.min(
    RETRY_BASE_DELAY_MS * (2 ** Math.max(0, transientFailureCount - 1)),
    RETRY_MAX_DELAY_MS,
  );
  const jitter = Math.floor(Math.random() * Math.min(5_000, exponentialDelay / 4));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void startSync();
  }, exponentialDelay + jitter);
}
