import { MarkdownDocument } from '../types';
import { wordCount } from '../utils/markdown';

const SAMPLE_CONTENT = `# Welcome to Marden

Your Markdown, beautifully kept. Marden gives your notes, guides, and long-form thinking a calm home — ready whenever you are.

> **Reading should feel effortless.** Tap the type control below to tune the page, open the outline to move through long files, or enter focus mode when you want the words to have the whole screen.

## A simple, durable flow

Import a \`.md\` or \`.markdown\` file from Files, Drive, or any document provider. Marden keeps a local copy in your private library and remembers where you stopped reading.

\`\`\`mermaid
flowchart TD
  A[Import Markdown] --> B{Ready to read?}
  B -->|Now| C[Open the reader]
  B -->|Later| D[Find it in Recents]
  C --> E[Resume from your place]
  D --> E
\`\`\`

## Made for real Markdown

Marden renders the pieces that make Markdown useful, not just the paragraphs:

- Clear heading hierarchy
- **Strong**, *emphasized*, and ~~struck~~ text
- Task lists and nested ideas
  1. Ordered steps stay aligned
     - Supporting points nest cleanly below them
  2. Mixed lists remain easy to scan
- [ ] Tap a task in the reader to complete it
- Tables, links, quotes, and code
- Mermaid flowcharts rendered as native diagrams

| Reading tool | What it does |
| --- | --- |
| Outline | Moves through long documents |
| Type control | Changes the reading scale |
| Focus mode | Hides everything but the page |
| Progress | Remembers your place |

## A small code sample

\`\`\`typescript
const library = await Marden.open();
await library.keep(markdownFile);
\`\`\`

## Your library stays yours

Files are kept on this device. There is no account wall and no cloud dependency in the reading path.

---

When you are ready, return to the library and tap **Import Markdown**. This welcome guide stays here as a handy rendering reference.
`;

export const sampleDocument = (): MarkdownDocument => {
  const now = Date.now();
  return {
    id: 'marden-welcome-guide',
    title: 'Welcome to Marden',
    fileName: 'welcome-to-marden.md',
    content: SAMPLE_CONTENT,
    createdAt: now,
    modifiedAt: now,
    lastOpenedAt: now,
    isFavorite: true,
    readingProgress: 0,
    wordCount: wordCount(SAMPLE_CONTENT),
    projectId: null,
  };
};
