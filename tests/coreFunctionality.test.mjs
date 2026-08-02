import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addMarkdownHighlight,
  createDocument,
  extractHeadings,
  getSearchMatches,
  markdownFileName,
  plainTextFromMarkdown,
  previewFromMarkdown,
  safeDocumentName,
  setTaskListItemChecked,
  titleFromMarkdown,
  wordCount,
} from '../src/utils/markdown.ts';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createLibraryBackup,
  mergeLibraryBackup,
  parseLibraryBackup,
} from '../src/storage/libraryBackup.ts';
import { compareVersions } from '../src/utils/version.ts';

const document = (overrides = {}) => ({
  id: 'document-1',
  title: 'First document',
  fileName: 'first-document.md',
  content: '# First document\n\nUseful text.',
  createdAt: 100,
  modifiedAt: 100,
  lastOpenedAt: 100,
  isFavorite: false,
  readingProgress: 0.25,
  wordCount: 4,
  projectId: null,
  deviceModifiedAt: 100,
  ...overrides,
});

const project = (overrides = {}) => ({
  id: 'project-1',
  name: 'Research',
  color: '#315C4A',
  createdAt: 100,
  deviceModifiedAt: 100,
  ...overrides,
});

test('document naming is safe and retains one Markdown extension', () => {
  assert.equal(safeDocumentName('  Plans: Q3?.markdown  '), 'Plans- Q3-');
  assert.equal(markdownFileName('Plans.md'), 'Plans.md');
  assert.equal(safeDocumentName('///'), '---');
});

test('titles, previews, and outlines ignore fenced code', () => {
  const content = '```md\n# Not the title\n```\n\n# Real title\n\nA useful preview.';
  assert.equal(titleFromMarkdown(content, 'fallback.md'), 'Real title');
  assert.equal(previewFromMarkdown(content), 'A useful preview.');
  assert.deepEqual(extractHeadings(content).map((heading) => heading.title), ['Real title']);
});

test('reader transformations preserve content semantics', () => {
  const content = '# Guide\n\n- [ ] First task\n- [x] Second task\n\nRead [the docs](https://example.com).';
  assert.equal(setTaskListItemChecked(content, 0, true).includes('- [x] First task'), true);
  assert.equal(setTaskListItemChecked(content, 9, true), content);
  assert.equal(addMarkdownHighlight(content, 'the docs').includes('[==the docs==](https://example.com)'), true);
  assert.equal(addMarkdownHighlight('Already ==marked==.', 'marked'), 'Already ==marked==.');
  assert.match(plainTextFromMarkdown(content), /Read the docs\./);
  assert.equal(wordCount('Words outside.\n\n```js\nignored code words\n```'), 2);
});

test('reader search is case-insensitive and excludes closed or unclosed code fences', () => {
  const result = getSearchMatches('Needle\n```\nneedle\n```\nneedle\n~~~js\nneedle', 'needle');
  assert.equal(result.matches.length, 2);
  assert.equal((result.patchedContent.match(/==/g) || []).length, 4);
});

test('new documents receive complete editable metadata', () => {
  const created = createDocument('answer.md', '# Saved answer', 'project-1');
  assert.equal(created.title, 'Saved answer');
  assert.equal(created.projectId, 'project-1');
  assert.equal(created.wordCount, 2);
  assert.equal(created.deviceModifiedAt, created.modifiedAt);
});

test('backups remove account ownership and round-trip through validation', () => {
  const backup = createLibraryBackup([
    document({ cloudId: 'cloud-doc', cloudUserId: 'user-a', cloudVersion: 'v1' }),
  ], [project({ cloudId: 'cloud-project', cloudUserId: 'user-a' })]);
  const parsed = parseLibraryBackup(JSON.stringify(backup));
  assert.equal(parsed.format, BACKUP_FORMAT);
  assert.equal(parsed.version, BACKUP_VERSION);
  assert.equal(parsed.documents[0].cloudId, undefined);
  assert.equal(parsed.projects[0].cloudUserId, undefined);
});

test('backup validation rejects malformed and duplicate records', () => {
  assert.throws(() => parseLibraryBackup('{nope'), /not valid JSON/);
  const duplicate = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: 100,
    documents: [document(), document()],
    projects: [],
  };
  assert.throws(() => parseLibraryBackup(JSON.stringify(duplicate)), /duplicate/);
});

test('backup restore merges without overwriting and remaps projects', () => {
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: 100,
    projects: [project()],
    documents: [document({ projectId: 'project-1' })],
  };
  const merged = mergeLibraryBackup(
    [document({ content: '# Existing body' })],
    [project({ name: 'Existing project' })],
    backup,
  );
  assert.equal(merged.documents.length, 2);
  assert.equal(merged.projects.length, 2);
  const restored = merged.documents.find((item) => item.content.includes('Useful text'));
  assert.ok(restored);
  assert.notEqual(restored.id, 'document-1');
  assert.match(restored.fileName, /\(2\)\.md$/);
  assert.equal(restored.projectId, merged.projects[1].id);
  assert.equal(restored.cloudId, undefined);
});

test('release version comparison handles v prefixes, suffixes, and patch values', () => {
  assert.equal(compareVersions('v2.0.0', '1.9.9'), 1);
  assert.equal(compareVersions('2.0', '2.0.0'), 0);
  assert.equal(compareVersions('2.0.1-beta.1', '2.0.0'), 1);
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
});
