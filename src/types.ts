export type MarkdownDocument = {
  id: string;
  title: string;
  fileName: string;
  content: string;
  createdAt: number;
  modifiedAt: number;
  lastOpenedAt: number;
  isFavorite: boolean;
  readingProgress: number;
  wordCount: number;
  projectId: string | null;
  /** Supabase document UUID — null when not yet pushed to cloud. */
  cloudId?: string | null;
  /** Device‑local timestamp set on every edit; used for LWW conflict resolution. */
  deviceModifiedAt?: number;
  /** Server‑side modified_at from the last successful cloud push. */
  cloudModifiedAt?: number;
  /** Device‑local timestamp when the user deleted this document (soft delete). */
  deletedAt?: number;
};

export type Project = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  /** Supabase project UUID — null when not yet pushed to cloud. */
  cloudId?: string | null;
  /** Device‑local timestamp for conflict resolution. */
  deviceModifiedAt?: number;
  /** Server‑side modified_at from the last successful cloud push. */
  cloudModifiedAt?: number;
};

export type LibraryFilter = 'all' | 'favorites';

export type ProjectFilter = 'all' | 'unfiled' | string;

export type TextScale = 'compact' | 'comfortable' | 'large';

export type Heading = {
  level: number;
  title: string;
  sourceOffset: number;
};

/** Visual indicator for per‑document sync state. */
export type SyncStatus = 'local' | 'synced' | 'pending' | 'conflict' | 'error';

/** Aggregate sync state shown in the library header. */
export type CloudSyncState = 'disconnected' | 'synced' | 'pending' | 'error';

/** Persisted sync metadata (AsyncStorage key: marden.sync.meta.v1). */
export type SyncMetadata = {
  userId: string;
  lastPullAt: number | null;
  lastPushAt: number | null;
};

/** Cloud document shape returned by Supabase (snake_case columns). */
export type CloudDocument = {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  content: string;
  created_at: string;
  modified_at: string;
  last_opened_at: string;
  is_favorite: boolean;
  reading_progress: number;
  word_count: number;
  project_id: string | null;
  local_id: string | null;
  device_modified_at: string | null;
  deleted_at: string | null;
};

/** Cloud project shape returned by Supabase. */
export type CloudProject = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  local_id: string | null;
  modified_at: string | null;
  deleted_at: string | null;
};

/** Cloud preferences shape. */
export type CloudPreferences = {
  user_id: string;
  dark_mode: boolean;
  text_scale: string;
  updated_at: string;
};
