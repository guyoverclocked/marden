import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { MarkdownDocument } from '../types';
import { markdownFileName } from '../utils/markdown';

const EXPORT_CACHE_DIR = 'MardenExports';
const EXPORTS_DIRECTORY_NATIVE = 'MardenExports';

const ensureExportsDirectory = () => {
  const dir = new Directory(Paths.cache, EXPORT_CACHE_DIR);
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return dir;
};
/**
 * Sanitize a filename for filesystem use while preserving readability.
 */
const sanitizedFileName = (fileName: string) => {
  // Already sanitized by markdownFileName but ensure no path separators
  return fileName.replace(/[\\/:*?"<>|]/g, '-');
};

/**
 * Write a single Markdown document to a temporary file ready for sharing/downloading.
 * Returns the File instance.
 */
export const prepareMarkdownFile = (document: MarkdownDocument): File => {
  const name = sanitizedFileName(document.fileName || markdownFileName(document.title));
  if (Platform.OS === 'web') {
    // On web, File is not needed — caller will use blob download.
    // Return a dummy File-like object for type uniformity handled separately.
    // We still create a cache file if possible, but web fallback uses blob.
    throw new Error('Use downloadMarkdownOnWeb for web platform');
  }
  const dir = ensureExportsDirectory();
  const file = new File(dir, name);
  file.write(document.content);
  return file;
};

export const downloadMarkdownOnWeb = (document: MarkdownDocument) => {
  const blob = new Blob([document.content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = sanitizedFileName(document.fileName || markdownFileName(document.title));
  globalThis.document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Export a single document: download on web, share sheet on native.
 * Returns true if sharing/download was initiated.
 */
export const exportSingleMarkdown = async (document: MarkdownDocument): Promise<boolean> => {
  if (Platform.OS === 'web') {
    downloadMarkdownOnWeb(document);
    return true;
  }
  const file = prepareMarkdownFile(document);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    dialogTitle: `Share ${document.fileName}`,
    mimeType: 'text/markdown',
    UTI: 'net.daringfireball.markdown',
  });
  return true;
};

/**
 * Export multiple documents.
 * On web: triggers sequential downloads with a small stagger to avoid popup blocking.
 * On native: shares each file sequentially; user confirms each share.
 * Returns count of files handled.
 */
export const exportMultipleMarkdowns = async (
  documents: MarkdownDocument[],
  onProgress?: (index: number, total: number) => void,
): Promise<number> => {
  if (documents.length === 0) return 0;

  if (Platform.OS === 'web') {
    for (let i = 0; i < documents.length; i++) {
      downloadMarkdownOnWeb(documents[i]);
      onProgress?.(i + 1, documents.length);
      if (i < documents.length - 1) {
        // Small delay to let browser register each download
        await new Promise((r) => setTimeout(r, 280));
      }
    }
    return documents.length;
  }

  // Native: copy all to exports dir first, then share one by one with haptics
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  for (let i = 0; i < documents.length; i++) {
    const file = prepareMarkdownFile(documents[i]);
    onProgress?.(i + 1, documents.length);
    await Sharing.shareAsync(file.uri, {
      dialogTitle: `Share ${documents[i].fileName} (${i + 1}/${documents.length})`,
      mimeType: 'text/markdown',
      UTI: 'net.daringfireball.markdown',
    });
    if (i < documents.length - 1) {
      // Brief pause between share sheets so the system can settle
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return documents.length;
};

/**
 * Save copies of documents to the app's document directory for durable offline access
 * and system Files visibility. Useful for "Save to Device" without invoking share sheet.
 */
export const saveMarkdownsToDevice = async (documents: MarkdownDocument[]): Promise<string[]> => {
  if (Platform.OS === 'web') {
    // On web there's no device filesystem — just download
    for (const doc of documents) downloadMarkdownOnWeb(doc);
    return documents.map((d) => d.fileName);
  }

  // Use document directory so files appear in Files app on iOS/Android when appropriate
  const docDir = new Directory(Paths.document, EXPORTS_DIRECTORY_NATIVE);
  if (!docDir.exists) docDir.create({ idempotent: true, intermediates: true });

  const saved: string[] = [];
  const usedNames = new Set<string>();

  for (const doc of documents) {
    let baseName = sanitizedFileName(doc.fileName || markdownFileName(doc.title));
    let candidate = baseName;
    let suffix = 2;
    // De-duplicate within this batch
    while (usedNames.has(candidate.toLowerCase())) {
      const nameWithoutExt = baseName.replace(/\.md$/i, '');
      candidate = `${nameWithoutExt} (${suffix}).md`;
      suffix += 1;
    }
    usedNames.add(candidate.toLowerCase());

    const existing = new File(docDir, candidate);
    if (existing.exists) {
      // Make unique against existing files on disk
      let diskCandidate = candidate;
      let diskSuffix = 2;
      while (new File(docDir, diskCandidate).exists) {
        const nameWithoutExt = baseName.replace(/\.md$/i, '');
        diskCandidate = `${nameWithoutExt} (${diskSuffix}).md`;
        diskSuffix += 1;
      }
      candidate = diskCandidate;
      usedNames.add(candidate.toLowerCase());
    }

    const file = new File(docDir, candidate);
    file.write(doc.content);
    saved.push(file.uri);
  }

  return saved;
};
