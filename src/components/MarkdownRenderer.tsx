import React, { useMemo } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import type { MarkdownStyle } from 'react-native-enriched-markdown';

import { colors, fonts, radii } from '../theme';
import { TextScale } from '../types';
import { MermaidDiagram } from './MermaidDiagram';

type MarkdownRendererProps = {
  content: string;
  textScale: TextScale;
  darkMode?: boolean;
  selectable?: boolean;
  wideLayout?: boolean;
  availableWidth?: number;
  onTaskListItemPress?: (event: { index: number; checked: boolean; text: string }) => void;
  onHighlightRequest?: (segmentMarkdown: string, segmentOffset: number, selectedText: string) => void;
};

type RenderSegment =
  | {
      kind: 'markdown';
      markdown: string;
      fullWidth: boolean;
      taskOffset: number;
      sourceOffset: number;
    }
  | {
      kind: 'mermaid';
      source: string;
    };

const sizes = {
  compact: { body: 15, line: 25, h1: 31, h2: 23, h3: 18, table: 12, tableHead: 11.5, tableLine: 18 },
  comfortable: { body: 17, line: 29, h1: 34, h2: 25, h3: 20, table: 14, tableHead: 13.5, tableLine: 21 },
  large: { body: 19, line: 32, h1: 38, h2: 28, h3: 22, table: 16, tableHead: 15.5, tableLine: 24 },
};

const FENCE_START = /^ {0,3}(\x60{3,}|~{3,})\s*([^\s]*)?.*$/;
const TASK_LIST_ITEM = /^\s*[-+*]\s+\[[ xX]\]\s+/gm;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const RENDERER_CONTAINER_STYLE = { width: '100%' } as const;

const isTableHeader = (line: string) => line.includes('|') && line.trim().length > 0;

const countTaskListItems = (markdown: string) => (markdown.match(TASK_LIST_ITEM) || []).length;

/**
 * The maintained renderer intentionally has no AST rule hook. Split only
 * Mermaid fences (which Marden renders natively) and desktop tables. This
 * leaves all ordinary Markdown in the maintained parser while allowing prose
 * and data-heavy blocks to use different measured widths.
 */
const splitMarkdown = (content: string, separateWideTables: boolean): RenderSegment[] => {
  const normalized = content.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const segments: RenderSegment[] = [];
  let buffer: string[] = [];
  let bufferStart = 0;
  let globalIdx = 0;
  let taskOffset = 0;

  const pushMarkdown = (markdown: string, fullWidth: boolean) => {
    if (!markdown.trim()) return;
    segments.push({ kind: 'markdown', markdown, fullWidth, taskOffset, sourceOffset: bufferStart });
    taskOffset += countTaskListItems(markdown);
  };

  const advance = (line: string) => {
    globalIdx += line.length + 1;
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (buffer.length === 0) bufferStart = globalIdx;
    const fenceMatch = lines[index].match(FENCE_START);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const language = (fenceMatch[2] || '').toLowerCase();
      const closingFence = new RegExp('^ {0,3}' + marker.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&') + '\\s*$');

      if (language === 'mermaid') {
        pushMarkdown(buffer.join('\n'), false);
        buffer = [];
        advance(lines[index]);
        const diagramSources: string[] = [];
        index += 1;
        while (index < lines.length && !closingFence.test(lines[index])) {
          diagramSources.push(lines[index]);
          advance(lines[index]);
          index += 1;
        }
        segments.push({ kind: 'mermaid', source: diagramSources.join('\n') });
        continue;
      }

      buffer.push(lines[index]);
      advance(lines[index]);
      index += 1;
      while (index < lines.length && !closingFence.test(lines[index])) {
        buffer.push(lines[index]);
        advance(lines[index]);
        index += 1;
      }
      if (index < lines.length) { buffer.push(lines[index]); advance(lines[index]); }
      continue;
    }

    if (separateWideTables && isTableHeader(lines[index]) && TABLE_DIVIDER.test(lines[index + 1] || '')) {
      pushMarkdown(buffer.join('\n'), false);
      buffer = [];

      const tableLines = [lines[index], lines[index + 1]];
      advance(lines[index]);
      advance(lines[index + 1]);
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        tableLines.push(lines[index]);
        advance(lines[index]);
        index += 1;
      }
      pushMarkdown(tableLines.join('\n'), true);
      index -= 1;
      continue;
    }

    buffer.push(lines[index]);
    advance(lines[index]);
  }

  pushMarkdown(buffer.join('\n'), false);
  return segments;
};

function MarkdownRendererComponent({
  content,
  textScale,
  darkMode = false,
  selectable = false,
  wideLayout = false,
  availableWidth = 720,
  onTaskListItemPress,
  onHighlightRequest,
}: MarkdownRendererProps) {
  const scale = sizes[textScale];
  const segments = useMemo(() => splitMarkdown(content, wideLayout), [content, wideLayout]);
  const reader = darkMode
    ? {
        ink: '#E9ECE7',
        inkSoft: '#C6CEC8',
        line: '#39423D',
        moss: '#B9D7C4',
        mossSoft: '#26372F',
        quote: '#1C2821',
        code: '#101512',
        table: '#1A211D',
        tableAlt: '#202822',
        tableHead: '#26372F',
        highlight: '#5A5426',
        selection: '#789B86',
      }
    : {
        ink: colors.ink,
        inkSoft: colors.inkSoft,
        line: colors.lineStrong,
        moss: colors.moss,
        mossSoft: colors.mossSoft,
        quote: '#EEF2ED',
        code: '#202622',
        table: colors.paperStrong,
        tableAlt: '#F7F6F1',
        tableHead: colors.sand,
        highlight: '#F2E9A9',
        selection: '#A8CAB4',
      };
  const markdownStyle = useMemo<MarkdownStyle>(
    () => ({
      paragraph: {
        color: reader.ink,
        fontFamily: fonts.regular,
        fontSize: scale.body,
        lineHeight: scale.line,
        marginTop: 6,
        marginBottom: 13,
      },
      h1: {
        color: reader.ink,
        fontFamily: fonts.semibold,
        fontSize: scale.h1,
        lineHeight: scale.h1 * 1.14,
        marginTop: 12,
        marginBottom: 15,
      },
      h2: {
        color: reader.ink,
        fontFamily: fonts.semibold,
        fontSize: scale.h2,
        lineHeight: scale.h2 * 1.22,
        marginTop: 34,
        marginBottom: 10,
      },
      h3: {
        color: reader.ink,
        fontFamily: fonts.semibold,
        fontSize: scale.h3,
        lineHeight: scale.h3 * 1.3,
        marginTop: 27,
        marginBottom: 7,
      },
      h4: {
        color: reader.ink,
        fontFamily: fonts.semibold,
        fontSize: scale.body,
        lineHeight: scale.line,
        marginTop: 20,
        marginBottom: 5,
      },
      h5: {
        color: reader.inkSoft,
        fontFamily: fonts.semibold,
        fontSize: Math.max(13, scale.body - 1),
        lineHeight: scale.line,
        marginTop: 18,
        marginBottom: 5,
      },
      h6: {
        color: reader.inkSoft,
        fontFamily: fonts.semibold,
        fontSize: Math.max(12, scale.body - 2),
        lineHeight: scale.line,
        marginTop: 16,
        marginBottom: 5,
      },
      strong: {
        color: reader.ink,
        fontFamily: fonts.semibold,
      },
      em: {
        color: reader.ink,
        fontFamily: fonts.regular,
      },
      link: {
        color: reader.moss,
        underline: true,
      },
      blockquote: {
        color: reader.inkSoft,
        fontFamily: fonts.regular,
        fontSize: scale.body,
        lineHeight: scale.line,
        marginTop: 15,
        marginBottom: 15,
        borderColor: reader.moss,
        borderWidth: 3,
        gapWidth: 17,
        backgroundColor: reader.quote,
      },
      list: {
        color: reader.ink,
        fontFamily: fonts.regular,
        fontSize: scale.body,
        lineHeight: scale.line,
        marginTop: 8,
        marginBottom: 13,
        marginLeft: 20,
        markerMinWidth: 24,
        gapWidth: 8,
        bulletColor: reader.moss,
        markerColor: reader.moss,
        markerFontWeight: '600',
      },
      code: {
        color: darkMode ? '#D7E9DD' : '#24483A',
        backgroundColor: reader.mossSoft,
        borderColor: reader.mossSoft,
        fontFamily: fonts.mono,
        fontSize: Math.max(12, scale.body - 3),
      },
      codeBlock: {
        color: '#E8EEE9',
        backgroundColor: reader.code,
        borderColor: darkMode ? '#303933' : '#202622',
        borderWidth: darkMode ? 1 : 0,
        borderRadius: radii.sm,
        padding: 17,
        fontFamily: fonts.mono,
        fontSize: Math.max(11.5, scale.body - 4.5),
        lineHeight: Math.max(19, scale.line - 9),
        marginTop: 15,
        marginBottom: 15,
      },
      thematicBreak: {
        color: reader.line,
        height: 1,
        marginTop: 28,
        marginBottom: 28,
      },
      table: {
        color: reader.ink,
        fontFamily: fonts.regular,
        fontSize: scale.table,
        lineHeight: scale.tableLine,
        marginTop: 18,
        marginBottom: 18,
        headerFontFamily: fonts.semibold,
        headerBackgroundColor: reader.tableHead,
        headerTextColor: reader.ink,
        rowEvenBackgroundColor: reader.table,
        rowOddBackgroundColor: reader.tableAlt,
        borderColor: reader.line,
        borderWidth: 1,
        borderRadius: radii.md,
        cellPaddingHorizontal: 13,
        cellPaddingVertical: 10,
      },
      taskList: {
        checkedColor: reader.moss,
        borderColor: reader.line,
        checkmarkColor: darkMode ? '#141816' : colors.paperStrong,
        checkedTextColor: reader.inkSoft,
        checkedStrikethrough: true,
      },
      highlight: {
        color: reader.ink,
        backgroundColor: reader.highlight,
      },
      spoiler: {
        color: reader.inkSoft,
        solid: { borderRadius: 6 },
      },
    }),
    [darkMode, reader, scale],
  );
  const rendererFlags = useMemo(
    () => ({
      highlight: true,
      superscript: true,
      subscript: true,
      // Native math needs an iOS dynamic-framework setup. Keep release builds
      // portable and treat currency and other dollar-sign text literally.
      latexMath: false,
    }),
    [],
  );
  const nativeSelectionProps =
    Platform.OS === 'web'
      ? {}
      : {
          flavor: 'github' as const,
          selectionHandleColor: reader.moss,
          selectionMenuConfig: {
            copy: { label: 'Copy' },
            copyAsMarkdown: { enabled: true, label: 'Copy as Markdown' },
            copyImageUrl: { enabled: true, label: 'Copy image URL' },
          },
          textBreakStrategy: 'highQuality' as const,
        };
  const proseWidth = Math.min(760, Math.max(1, availableWidth));

  return (
    <View style={styles.root}>
      {segments.map((segment, index) => {
        if (segment.kind === 'mermaid') {
          return <MermaidDiagram key={'mermaid-' + index} source={segment.source} darkMode={darkMode} />;
        }

        const fullWidth = wideLayout && segment.fullWidth;
        return (
          <View
            key={'markdown-' + index}
            style={[
              styles.segment,
              fullWidth ? styles.wideSegment : styles.proseSegment,
              { maxWidth: fullWidth ? Math.max(1, availableWidth) : wideLayout ? proseWidth : undefined },
            ]}
          >
            <EnrichedMarkdownText
              markdown={segment.markdown}
              markdownStyle={markdownStyle}
              containerStyle={RENDERER_CONTAINER_STYLE}
              selectable={selectable}
              selectionColor={reader.selection}
              allowTrailingMargin={index < segments.length - 1}
              md4cFlags={rendererFlags}
              onLinkPress={({ url }) => {
                void Linking.openURL(url).catch(() => undefined);
              }}
              onTaskListItemPress={
                onTaskListItemPress
                  ? ({ index: taskIndex, checked, text }) =>
                      onTaskListItemPress({ index: segment.taskOffset + taskIndex, checked, text })
                  : undefined
              }
              contextMenuItems={
                onHighlightRequest && selectable
                  ? [
                      {
                        text: 'Highlight',
                        onPress: ({ text: selectedText }) => {
                          onHighlightRequest(segment.markdown, segment.sourceOffset, selectedText);
                        },
                      },
                    ]
                  : undefined
              }
              {...nativeSelectionProps}
            />
          </View>
        );
      })}
    </View>
  );
}

// Reader chrome (progress, outline, and focus controls) can update without
// reparsing and reconciling the full Markdown document.
export const MarkdownRenderer = React.memo(MarkdownRendererComponent);

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  segment: {
    width: '100%',
    alignSelf: 'center',
  },
  proseSegment: {
    alignSelf: 'center',
  },
  wideSegment: {
    alignSelf: 'stretch',
  },
});
