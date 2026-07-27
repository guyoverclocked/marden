import { Heading, MarkdownDocument } from '../types';

export const stripExtension = (fileName: string) => fileName.replace(/\.(md|markdown|mdown|mkd)$/i, '');

export const safeDocumentName = (value: string) =>
  stripExtension(value)
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';

export const markdownFileName = (value: string) => `${safeDocumentName(value)}.md`;

export const titleFromMarkdown = (content: string, fileName: string) => {
  const firstHeading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return firstHeading || stripExtension(fileName).replace(/[-_]+/g, ' ').trim() || 'Untitled note';
};

export const wordCount = (content: string) => {
  const plainText = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, ' ')
    .replace(/[#>*_`~|\-]/g, ' ')
    .trim();

  return plainText ? plainText.split(/\s+/).length : 0;
};

/**
 * Converts a Markdown document to readable text for the reader's copy action.
 * It preserves code, list markers, and table rows while dropping presentation
 * syntax and link destinations.
 */
export const plainTextFromMarkdown = (content: string) =>
  content
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^(\s*)[-+*]\s+/gm, '$1• ')
    .replace(/^(\s*)(\d+)\.\s+/gm, '$1$2. ')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, '')
    .replace(/\|/g, '\t')
    .replace(/==([^=\n]+)==/g, '$1')
    .replace(/~~|\*\*|__|[*_`]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Persists a task toggle emitted by Enriched Markdown's GFM task-list UI.
 * The index is the renderer's document-order, zero-based task index.
 */
export const setTaskListItemChecked = (content: string, targetIndex: number, checked: boolean) => {
  let taskIndex = -1;
  let updated = false;
  const next = content.replace(/^(\s*[-+*]\s+\[)([ xX])(\]\s+)/gm, (match, start, _state, end) => {
    taskIndex += 1;
    if (taskIndex !== targetIndex) return match;
    updated = true;
    return start + (checked ? 'x' : ' ') + end;
  });

  return updated ? next : content;
};

export const readMinutes = (count: number) => Math.max(1, Math.ceil(count / 220));

export const previewFromMarkdown = (content: string) => {
  const paragraph = content
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith('#') && !part.startsWith('```'));

  return (paragraph || 'A beautifully kept Markdown document.')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#\-|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const extractHeadings = (content: string): Heading[] => {
  const headings: Heading[] = [];
  const expression = /^(#{1,4})\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = expression.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      title: match[2].replace(/[*_`]/g, '').trim(),
      sourceOffset: match.index,
    });
  }

  return headings;
};

export const createDocument = (
  fileName: string,
  content: string,
  projectId: string | null = null,
  explicitTitle?: string,
): MarkdownDocument => {
  const now = Date.now();
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
    title: explicitTitle?.trim() || titleFromMarkdown(content, fileName),
    fileName,
    content,
    createdAt: now,
    modifiedAt: now,
    lastOpenedAt: now,
    isFavorite: false,
    readingProgress: 0,
    wordCount: wordCount(content),
    projectId,
  };
};

export const formatRelativeDate = (timestamp: number) => {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(elapsed / 3_600_000);
  const days = Math.floor(elapsed / 86_400_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(timestamp);
};
