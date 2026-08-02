import { Heading, MarkdownDocument } from '../types';

export const stripExtension = (fileName: string) => fileName.replace(/\.(md|markdown|mdown|mkd)$/i, '');

export const safeDocumentName = (value: string) =>
  stripExtension(value.trim())
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';

export const markdownFileName = (value: string) => `${safeDocumentName(value)}.md`;

/** Replace fenced code with spaces while preserving source offsets. */
const withoutFencedCode = (content: string) => {
  let fenceCharacter: '`' | '~' | null = null;
  let minimumFenceLength = 0;
  return content.split('\n').map((line) => {
    if (!fenceCharacter) {
      const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (!opening) return line;
      fenceCharacter = opening[1][0] as '`' | '~';
      minimumFenceLength = opening[1].length;
      return ' '.repeat(line.length);
    }

    const closing = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
    const closesFence = closing
      && closing[1][0] === fenceCharacter
      && closing[1].length >= minimumFenceLength;
    if (closesFence) {
      fenceCharacter = null;
      minimumFenceLength = 0;
    }
    return ' '.repeat(line.length);
  }).join('\n');
};

export const titleFromMarkdown = (content: string, fileName: string) => {
  const firstHeading = withoutFencedCode(content).match(/^#\s+(.+)$/m)?.[1]?.trim();
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

export const readMinutes = (count: number) => Math.max(1, Math.ceil(count / 220));

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
 * Wrap a rendered selection in GitHub-flavoured Markdown highlight markers.
 * Keeping highlights in the document body makes exported Markdown portable
 * and lets normal document sync carry them to every signed-in device.
 */
export const addMarkdownHighlight = (
  content: string,
  selectedText: string,
  preferredOffset = 0,
): string => {
  if (!selectedText.trim()) return content;

  const startAt = Math.max(0, preferredOffset);
  let index = content.indexOf(selectedText, startAt);
  if (index === -1 && startAt > 0) index = content.indexOf(selectedText);
  if (index === -1) return content;

  const end = index + selectedText.length;
  if (content.slice(Math.max(0, index - 2), index) === '==' && content.slice(end, end + 2) === '==') {
    return content;
  }

  return `${content.slice(0, index)}==${content.slice(index, end)}==${content.slice(end)}`;
};

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

export const previewFromMarkdown = (content: string) => {
  const paragraph = withoutFencedCode(content)
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
  const searchableContent = withoutFencedCode(content);
  let match: RegExpExecArray | null;

  while ((match = expression.exec(searchableContent)) !== null) {
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
    deviceModifiedAt: now,
  };
};

export const getSearchMatches = (content: string, query: string) => {
  if (!query.trim()) return { patchedContent: content, matches: [] };

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');

  const lines = content.split('\n');
  const fenceRanges: { start: number; end: number }[] = [];
  let insideFence = false;
  let fenceStart = 0;
  let globalIdx = 0;

  for (const line of lines) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch && !insideFence) {
      insideFence = true;
      fenceStart = globalIdx;
    } else if (fenceMatch && insideFence) {
      insideFence = false;
      fenceRanges.push({ start: fenceStart, end: globalIdx + line.length });
    }
    globalIdx += line.length + 1;
  }
  if (insideFence) fenceRanges.push({ start: fenceStart, end: content.length });

  const isInsideFence = (pos: number) =>
    fenceRanges.some((r) => pos >= r.start && pos < r.end);

  const matches: { position: number; length: number }[] = [];
  let result = '';
  let contentIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (isInsideFence(match.index)) continue;

    result += content.slice(contentIdx, match.index);
    const wrapped = `==${match[0]}==`;
    matches.push({ position: result.length, length: match[0].length });
    result += wrapped;
    contentIdx = match.index + match[0].length;
  }
  result += content.slice(contentIdx);

  return { patchedContent: result, matches };
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
