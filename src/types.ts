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
};

export type Project = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
};

export type LibraryFilter = 'all' | 'favorites';

export type ProjectFilter = 'all' | 'unfiled' | string;

export type TextScale = 'compact' | 'comfortable' | 'large';

export type Heading = {
  level: number;
  title: string;
  sourceOffset: number;
};
