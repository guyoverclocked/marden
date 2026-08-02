import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDocumentDirty,
  mergeCloudDocuments,
  mergeCloudProjects,
  reconcileLiveLibrary,
} from '../src/storage/syncMerge.ts';
import { runSyncQuery } from '../src/storage/syncNetwork.ts';

const USER_ID = 'user-a';
const V1 = '2026-08-03T00:00:00.000Z';
const V2 = '2026-08-03T00:01:00.000Z';

const localDocument = (overrides = {}) => ({
  id: 'local-doc',
  title: 'Local title',
  fileName: 'local.md',
  content: '# Local',
  createdAt: 100,
  modifiedAt: 100,
  lastOpenedAt: 100,
  isFavorite: false,
  readingProgress: 0,
  wordCount: 1,
  projectId: null,
  deviceModifiedAt: 100,
  ...overrides,
});

const cloudDocument = (overrides = {}) => ({
  id: 'cloud-doc',
  user_id: USER_ID,
  title: 'Cloud title',
  file_name: 'cloud.md',
  content: '# Cloud',
  created_at: V1,
  modified_at: V2,
  last_opened_at: V2,
  is_favorite: false,
  reading_progress: 0,
  word_count: 1,
  project_id: null,
  local_id: 'local-doc',
  device_modified_at: V2,
  deleted_at: null,
  ...overrides,
});

const cloudProject = (overrides = {}) => ({
  id: 'cloud-project',
  user_id: USER_ID,
  name: 'Remote project',
  color: '#123456',
  created_at: V1,
  local_id: 'local-project',
  modified_at: V2,
  deleted_at: null,
  ...overrides,
});

test('a second device receives all four files in its live library', () => {
  const windowsWelcome = localDocument({
    id: 'marden-welcome-guide',
    title: 'Welcome to Marden',
    fileName: 'welcome-to-marden.md',
    content: '# Welcome',
  });
  const base = { documents: [{ ...windowsWelcome }], projects: [] };
  const syncedDocuments = [{ ...windowsWelcome }];
  const macFiles = Array.from({ length: 4 }, (_, index) => cloudDocument({
    id: `cloud-${index}`,
    local_id: `mac-${index}`,
    title: `Mac file ${index + 1}`,
    file_name: `mac-${index + 1}.md`,
    content: `# Mac file ${index + 1}`,
  }));

  mergeCloudDocuments(macFiles, syncedDocuments, [], USER_ID);
  const live = reconcileLiveLibrary({
    base,
    synced: { documents: syncedDocuments, projects: [] },
  }, {
    documents: [windowsWelcome],
    projects: [],
  });

  assert.equal(live.documents.length, 5);
  assert.deepEqual(
    live.documents.filter((document) => document.id.startsWith('mac-')).map((document) => document.fileName),
    ['mac-1.md', 'mac-2.md', 'mac-3.md', 'mac-4.md'],
  );
});

test('downloads remote projects before resolving their documents', () => {
  const projects = [];
  const documents = [];

  mergeCloudProjects([cloudProject()], projects, USER_ID);
  mergeCloudDocuments([
    cloudDocument({ project_id: 'cloud-project' }),
  ], documents, projects, USER_ID);

  assert.equal(projects.length, 1);
  assert.equal(documents.length, 1);
  assert.equal(documents[0].content, '# Cloud');
  assert.equal(documents[0].projectId, projects[0].id);
  assert.equal(documents[0].cloudUserId, USER_ID);
  assert.equal(isDocumentDirty(documents[0]), false);
});

test('keeps a local edit when the remote version has not changed', () => {
  const documents = [localDocument({
    cloudId: 'cloud-doc',
    cloudUserId: USER_ID,
    cloudVersion: V1,
    cloudModifiedAt: Date.parse(V1),
    syncedDeviceModifiedAt: 100,
    deviceModifiedAt: 200,
  })];

  mergeCloudDocuments([
    cloudDocument({
      title: 'Old cloud title',
      file_name: 'old.md',
      content: '# Old cloud',
      modified_at: V1,
      device_modified_at: new Date(100).toISOString(),
    }),
  ], documents, [], USER_ID);

  assert.equal(documents.length, 1);
  assert.equal(documents[0].content, '# Local');
  assert.equal(isDocumentDirty(documents[0]), true);
});

test('preserves both sides of a concurrent document edit', () => {
  const documents = [localDocument({
    cloudId: 'cloud-doc',
    cloudUserId: USER_ID,
    cloudVersion: V1,
    cloudModifiedAt: Date.parse(V1),
    syncedDeviceModifiedAt: 100,
    deviceModifiedAt: 200,
  })];

  mergeCloudDocuments([cloudDocument()], documents, [], USER_ID);

  assert.equal(documents.length, 2);
  const canonical = documents.find((document) => document.id === 'local-doc');
  const conflict = documents.find((document) => document.id !== 'local-doc');
  assert.equal(canonical.content, '# Cloud');
  assert.equal(isDocumentDirty(canonical), false);
  assert.equal(conflict.content, '# Local');
  assert.match(conflict.title, /conflict from Device/);
  assert.equal(conflict.cloudId, undefined);
  assert.equal(isDocumentDirty(conflict), true);
});

test('merges metadata-only concurrency without duplicating the document body', () => {
  const documents = [localDocument({
    title: 'Cloud title',
    fileName: 'cloud.md',
    content: '# Cloud',
    readingProgress: 0.75,
    cloudId: 'cloud-doc',
    cloudVersion: V1,
    cloudModifiedAt: Date.parse(V1),
    syncedDeviceModifiedAt: 100,
    deviceModifiedAt: 200,
  })];

  mergeCloudDocuments([
    cloudDocument({ is_favorite: true, reading_progress: 0.25 }),
  ], documents, [], USER_ID);

  assert.equal(documents.length, 1);
  assert.equal(documents[0].content, '# Cloud');
  assert.equal(documents[0].readingProgress, 0.75);
  assert.equal(documents[0].cloudVersion, V2);
  assert.equal(isDocumentDirty(documents[0]), true);
});

test('adopts an acknowledgement after a successful write response was lost', () => {
  const documents = [localDocument({
    title: 'Cloud title',
    fileName: 'cloud.md',
    content: '# Cloud',
    cloudId: 'cloud-doc',
    cloudVersion: V1,
    cloudModifiedAt: Date.parse(V1),
    syncedDeviceModifiedAt: 100,
    deviceModifiedAt: Date.parse(V2),
  })];

  mergeCloudDocuments([cloudDocument()], documents, [], USER_ID);

  assert.equal(documents.length, 1);
  assert.equal(documents[0].cloudVersion, V2);
  assert.equal(isDocumentDirty(documents[0]), false);
});

test('remote deletion removes a clean copy and recovers a concurrent local edit', () => {
  const clean = localDocument({
    cloudId: 'cloud-doc',
    cloudVersion: V1,
    cloudModifiedAt: Date.parse(V1),
    syncedDeviceModifiedAt: 100,
  });
  const documents = [clean];
  mergeCloudDocuments([
    cloudDocument({ modified_at: V2, deleted_at: V2 }),
  ], documents, [], USER_ID);
  assert.equal(documents.length, 0);

  const dirtyDocuments = [localDocument({
    cloudId: 'cloud-doc',
    cloudVersion: V1,
    cloudModifiedAt: Date.parse(V1),
    syncedDeviceModifiedAt: 100,
    deviceModifiedAt: 200,
  })];
  mergeCloudDocuments([
    cloudDocument({ modified_at: V2, deleted_at: V2 }),
  ], dirtyDocuments, [], USER_ID);
  assert.equal(dirtyDocuments.length, 1);
  assert.equal(dirtyDocuments[0].content, '# Local');
  assert.equal(dirtyDocuments[0].cloudId, undefined);
  assert.match(dirtyDocuments[0].title, /conflict from Device/);
});

test('clears cloud ownership metadata that belongs to another account', () => {
  const documents = [localDocument({
    cloudId: 'other-account-row',
    cloudUserId: 'user-b',
    cloudVersion: V1,
    syncedDeviceModifiedAt: 100,
  })];

  mergeCloudDocuments([], documents, [], USER_ID);

  assert.equal(documents[0].cloudId, undefined);
  assert.equal(documents[0].cloudUserId, undefined);
  assert.equal(isDocumentDirty(documents[0]), true);
});

test('live reconciliation keeps edits made while a sync is in flight', () => {
  const baseDocument = localDocument({ deviceModifiedAt: 200 });
  const syncedDocument = localDocument({
    deviceModifiedAt: 200,
    cloudId: 'cloud-doc',
    cloudUserId: USER_ID,
    cloudVersion: V2,
    cloudModifiedAt: Date.parse(V2),
    syncedDeviceModifiedAt: 200,
  });
  const currentDocument = localDocument({
    content: '# Edited during sync',
    deviceModifiedAt: 300,
  });

  const result = reconcileLiveLibrary({
    base: { documents: [baseDocument], projects: [] },
    synced: { documents: [syncedDocument], projects: [] },
  }, {
    documents: [currentDocument],
    projects: [],
  });

  assert.equal(result.documents[0].content, '# Edited during sync');
  assert.equal(result.documents[0].deviceModifiedAt, 300);
  assert.equal(result.documents[0].cloudVersion, V2);
  assert.equal(result.documents[0].syncedDeviceModifiedAt, 200);
  assert.equal(isDocumentDirty(result.documents[0]), true);
});

test('live reconciliation is referentially stable when sync changes nothing', () => {
  const document = localDocument();
  const documents = [document];
  const projects = [];
  const result = reconcileLiveLibrary({
    base: { documents: [{ ...document }], projects: [] },
    synced: { documents: [{ ...document }], projects: [] },
  }, { documents, projects });

  assert.equal(result.documents, documents);
  assert.equal(result.projects, projects);
});

test('network queries retry transient failures with bounded backoff', async () => {
  let attempts = 0;
  const delays = [];
  const result = await runSyncQuery('test pull', async () => {
    attempts += 1;
    return attempts < 3
      ? { data: null, error: { status: 503, message: 'temporarily unavailable' } }
      : { data: ['recovered'], error: null };
  }, {
    maxAttempts: 3,
    timeoutMs: 100,
    random: () => 0,
    wait: async (delay) => { delays.push(delay); },
    warn: () => {},
  });

  assert.deepEqual(result, ['recovered']);
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [300, 600]);
});

test('network retries use the PostgREST response status', async () => {
  let attempts = 0;
  const result = await runSyncQuery('status pull', async () => {
    attempts += 1;
    return attempts === 1
      ? { data: null, error: { message: 'server unavailable' }, status: 503 }
      : { data: 'recovered', error: null, status: 200 };
  }, {
    maxAttempts: 2,
    timeoutMs: 100,
    random: () => 0,
    wait: async () => {},
    warn: () => {},
  });
  assert.equal(result, 'recovered');
  assert.equal(attempts, 2);
});

test('network queries fail fast for permission and schema errors', async () => {
  let attempts = 0;
  await assert.rejects(() => runSyncQuery('test push', async () => {
    attempts += 1;
    return { data: null, error: { status: 403, message: 'forbidden' } };
  }, {
    maxAttempts: 3,
    timeoutMs: 100,
    wait: async () => {},
    warn: () => {},
  }), /forbidden/);
  assert.equal(attempts, 1);
});

test('PostgREST abort responses are treated as retryable transport failures', async () => {
  let attempts = 0;
  const result = await runSyncQuery('timed pull', async () => {
    attempts += 1;
    return attempts === 1
      ? { data: null, error: { status: 400, message: 'FetchError: user aborted a request' } }
      : { data: 'recovered', error: null };
  }, {
    maxAttempts: 2,
    timeoutMs: 100,
    random: () => 0,
    wait: async () => {},
    warn: () => {},
  });
  assert.equal(result, 'recovered');
  assert.equal(attempts, 2);
});

test('network queries abort a hung request instead of leaving sync pending forever', async () => {
  await assert.rejects(() => runSyncQuery('hung pull', (signal) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('request aborted')), { once: true });
  }), {
    maxAttempts: 1,
    timeoutMs: 5,
    warn: () => {},
  }), /aborted/);
});
