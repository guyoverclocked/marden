-- ====================================================================
-- Marden v2.0.0 — Supabase Database Schema
-- Run in Supabase SQL Editor as a single query.
-- ====================================================================

-- 1. Extensions ---------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tables -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#315C4A',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  local_id    TEXT,
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS documents (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL DEFAULT 'Untitled',
  file_name          TEXT NOT NULL,
  content            TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_favorite        BOOLEAN NOT NULL DEFAULT false,
  reading_progress   REAL NOT NULL DEFAULT 0.0,
  word_count         INTEGER NOT NULL DEFAULT 0,
  project_id         UUID REFERENCES projects(id) ON DELETE SET NULL,
  local_id           TEXT,
  device_modified_at TIMESTAMPTZ,
  deleted_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS preferences (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dark_mode   BOOLEAN NOT NULL DEFAULT false,
  text_scale  TEXT NOT NULL DEFAULT 'comfortable',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2a. Upgrade projects created by an earlier Marden schema. PostgreSQL's
-- ADD COLUMN IF NOT EXISTS makes this safe for both new and existing projects.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS local_id TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reading_progress REAL NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS word_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS local_id TEXT,
  ADD COLUMN IF NOT EXISTS device_modified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS text_scale TEXT NOT NULL DEFAULT 'comfortable',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. Indexes ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_projects_user_id
  ON projects(user_id);
-- PostgreSQL permits multiple NULLs in a unique index, so this form supports
-- idempotent upserts on (user_id, local_id) without a partial-index conflict.
DROP INDEX IF EXISTS idx_projects_user_local;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_user_local
  ON projects(user_id, local_id);

CREATE INDEX IF NOT EXISTS idx_documents_user_id
  ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_modified
  ON documents(user_id, modified_at);
DROP INDEX IF EXISTS idx_documents_user_local;
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_user_local
  ON documents(user_id, local_id);

-- 4. Row-Level Security -------------------------------------------------

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

-- The schema is safe to re-run in the Supabase SQL Editor.
DROP POLICY IF EXISTS "projects_own_select" ON projects;
DROP POLICY IF EXISTS "projects_own_insert" ON projects;
DROP POLICY IF EXISTS "projects_own_update" ON projects;
DROP POLICY IF EXISTS "projects_own_delete" ON projects;
DROP POLICY IF EXISTS "documents_own_select" ON documents;
DROP POLICY IF EXISTS "documents_own_insert" ON documents;
DROP POLICY IF EXISTS "documents_own_update" ON documents;
DROP POLICY IF EXISTS "documents_own_delete" ON documents;
DROP POLICY IF EXISTS "preferences_own_select" ON preferences;
DROP POLICY IF EXISTS "preferences_own_insert" ON preferences;
DROP POLICY IF EXISTS "preferences_own_update" ON preferences;

-- 4a. Projects — users CRUD their own
CREATE POLICY "projects_own_select" ON projects
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "projects_own_insert" ON projects
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "projects_own_update" ON projects
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "projects_own_delete" ON projects
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 4b. Documents — users CRUD their own
CREATE POLICY "documents_own_select" ON documents
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "documents_own_insert" ON documents
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "documents_own_update" ON documents
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "documents_own_delete" ON documents
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 4c. Preferences — users read/write their own
CREATE POLICY "preferences_own_select" ON preferences
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "preferences_own_insert" ON preferences
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "preferences_own_update" ON preferences
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 5. Sync helper function -----------------------------------------------
-- Returns all rows modified after a given timestamp for a user, including
-- tombstones (deleted rows) so deletions propagate to other devices.
-- Called by the pull phase of the sync engine.
-- The function runs with elevated table access, so it always binds the result
-- set to auth.uid(). The user_uuid parameter is retained for a stable RPC
-- signature and is checked as a further guard; callers cannot select another
-- user's data by changing it.

CREATE OR REPLACE FUNCTION pull_changes_since(
  since_timestamp TIMESTAMPTZ,
  user_uuid       UUID
)
RETURNS TABLE(entity_type TEXT, entity_data JSONB)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 'document'::TEXT,
         to_jsonb(d)
  FROM public.documents d
  WHERE d.user_id = (SELECT auth.uid())
    AND user_uuid = (SELECT auth.uid())
    AND (d.modified_at > since_timestamp
         OR (d.deleted_at IS NOT NULL AND d.deleted_at > since_timestamp))
  UNION ALL
  SELECT 'project'::TEXT,
         to_jsonb(p)
  FROM public.projects p
  WHERE p.user_id = (SELECT auth.uid())
    AND user_uuid = (SELECT auth.uid())
    AND (p.modified_at > since_timestamp
         OR (p.deleted_at IS NOT NULL AND p.deleted_at > since_timestamp))
  UNION ALL
  SELECT 'preference'::TEXT,
         to_jsonb(pr)
  FROM public.preferences pr
  WHERE pr.user_id = (SELECT auth.uid())
    AND user_uuid = (SELECT auth.uid())
    AND pr.updated_at > since_timestamp;
$$;

-- Only signed-in users may call the helper. It still enforces auth.uid() in
-- the function body as defence in depth.
REVOKE EXECUTE ON FUNCTION pull_changes_since(TIMESTAMPTZ, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION pull_changes_since(TIMESTAMPTZ, UUID) TO authenticated;
