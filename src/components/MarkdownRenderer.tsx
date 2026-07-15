import React, { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';

import { colors, fonts, radii } from '../theme';
import { TextScale } from '../types';
import { CodeBlock } from './CodeBlock';
import { MermaidDiagram } from './MermaidDiagram';

type MarkdownRendererProps = {
  content: string;
  textScale: TextScale;
  darkMode?: boolean;
};

const sizes = {
  compact: { body: 15, line: 25, h1: 31, h2: 23, h3: 18 },
  comfortable: { body: 17, line: 29, h1: 34, h2: 25, h3: 20 },
  large: { body: 19, line: 32, h1: 38, h2: 28, h3: 22 },
};

// Standard Markdown links stay enabled; bare-URL scanning and raw HTML are disabled.
const markdownParser = MarkdownIt({ typographer: true, linkify: false, html: false });

const tableColumnWidth = (index: number, columnCount: number) => {
  if (columnCount === 2) return index === 0 ? 230 : 410;
  if (columnCount === 3) return [200, 180, 310][index] || 180;
  if (columnCount === 4) return [180, 150, 90, 320][index] || 180;
  return index === columnCount - 1 ? 280 : 170;
};

function MarkdownRendererComponent({ content, textScale, darkMode = false }: MarkdownRendererProps) {
  const scale = sizes[textScale];
  const reader = darkMode
    ? {
        ink: '#E9ECE7',
        inkSoft: '#C6CEC8',
        line: '#39423D',
        moss: '#B9D7C4',
        mossSoft: '#26372F',
        sand: '#252C28',
        quote: '#1C2821',
        code: '#101512',
      }
    : {
        ink: colors.ink,
        inkSoft: colors.inkSoft,
        line: colors.lineStrong,
        moss: colors.moss,
        mossSoft: colors.mossSoft,
        sand: colors.sand,
        quote: '#EEF2ED',
        code: '#202622',
      };
  const markdownStyles = useMemo(
    () => ({
      body: {
        color: reader.ink,
        fontFamily: fonts.regular,
        fontSize: scale.body,
        lineHeight: scale.line,
      },
      heading1: {
        marginTop: 12,
        marginBottom: 15,
        color: reader.ink,
        fontFamily: fonts.semibold,
        fontSize: scale.h1,
        lineHeight: scale.h1 * 1.14,
        letterSpacing: -1.15,
      },
      heading2: {
        marginTop: 34,
        marginBottom: 10,
        color: reader.ink,
        fontFamily: fonts.semibold,
        fontSize: scale.h2,
        lineHeight: scale.h2 * 1.22,
        letterSpacing: -0.65,
      },
      heading3: {
        marginTop: 27,
        marginBottom: 7,
        color: reader.ink,
        fontFamily: fonts.semibold,
        fontSize: scale.h3,
        lineHeight: scale.h3 * 1.3,
        letterSpacing: -0.35,
      },
      heading4: {
        marginTop: 20,
        marginBottom: 5,
        color: reader.ink,
        fontFamily: fonts.semibold,
        fontSize: scale.body,
        lineHeight: scale.line,
      },
      paragraph: {
        marginTop: 6,
        marginBottom: 13,
        flexWrap: 'wrap' as const,
        flexDirection: 'row' as const,
        alignItems: 'flex-start' as const,
        width: '100%' as const,
      },
      strong: {
        color: reader.ink,
        fontFamily: fonts.semibold,
        fontWeight: '600' as const,
      },
      em: { fontStyle: 'italic' as const },
      link: {
        color: reader.moss,
        textDecorationLine: 'underline' as const,
        textDecorationColor: reader.mossSoft,
      },
      blockquote: {
        marginVertical: 15,
        marginLeft: 0,
        paddingVertical: 13,
        paddingHorizontal: 17,
        borderLeftWidth: 3,
        borderLeftColor: reader.moss,
        borderRadius: 2,
        backgroundColor: reader.quote,
      },
      bullet_list: { marginVertical: 8 },
      ordered_list: { marginVertical: 8 },
      list_item: { marginBottom: 6, flexDirection: 'row' as const },
      bullet_list_icon: { marginLeft: 5, marginRight: 10, color: reader.moss },
      ordered_list_icon: { marginLeft: 4, marginRight: 9, color: reader.moss },
      code_inline: {
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderWidth: 0,
        borderRadius: 6,
        color: darkMode ? '#D7E9DD' : '#24483A',
        backgroundColor: reader.mossSoft,
        fontFamily: fonts.mono,
        fontSize: Math.max(12, scale.body - 3),
      },
      code_block: {
        marginVertical: 15,
        padding: 17,
        borderWidth: 0,
        borderRadius: radii.sm,
        color: '#E8EEE9',
        backgroundColor: reader.code,
        fontFamily: fonts.mono,
        fontSize: 12.5,
        lineHeight: 20,
      },
      fence: {
        marginVertical: 15,
        padding: 17,
        borderWidth: 0,
        borderRadius: radii.sm,
        color: '#E8EEE9',
        backgroundColor: reader.code,
        fontFamily: fonts.mono,
        fontSize: 12.5,
        lineHeight: 20,
      },
      hr: { height: 1, marginVertical: 28, backgroundColor: reader.line },
      table: {
        borderWidth: 0,
      },
      thead: {},
      tr: {},
      th: {
        color: reader.ink,
        fontFamily: fonts.semibold,
        fontSize: 12,
        lineHeight: 18,
      },
      td: {
        color: reader.ink,
        fontFamily: fonts.regular,
        fontSize: 13,
        lineHeight: 20,
      },
      image: { flex: 1, borderRadius: 12 },
    }),
    [darkMode, reader, scale],
  );

  const rules = useMemo(
    () => ({
      fence: (node: { key: string; content: string; sourceInfo?: string }) => {
        // Markdown-It allows optional metadata after the language. Only the
        // first token identifies the language (for example: ts title="app.ts").
        const language = (node.sourceInfo || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
        if (language === 'mermaid') {
          return <MermaidDiagram key={node.key} source={node.content} darkMode={darkMode} />;
        }

        return <CodeBlock key={node.key} code={node.content} language={language} darkMode={darkMode} />;
      },
      code_block: (node: { key: string; content: string }) => (
        <CodeBlock key={node.key} code={node.content} darkMode={darkMode} />
      ),
      table: (node: { key: string }, children: React.ReactNode) => (
        <View key={node.key} style={[styles.tableShell, darkMode && styles.tableShellDark]}>
          <View style={[styles.tableHint, darkMode && styles.tableHintDark]}>
            <Text style={[styles.tableHintLabel, darkMode && styles.tableHintLabelDark]}>TABLE</Text>
            <Text style={[styles.tableHintCopy, darkMode && styles.tableHintCopyDark]}>
              Swipe sideways to see all columns →
            </Text>
          </View>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator
            contentContainerStyle={styles.tableScrollContent}
          >
            <View>{children}</View>
          </ScrollView>
        </View>
      ),
      thead: (node: { key: string }, children: React.ReactNode) => (
        <View key={node.key} style={[styles.tableHead, darkMode && styles.tableHeadDark]}>
          {children}
        </View>
      ),
      tbody: (node: { key: string }, children: React.ReactNode) => (
        <View key={node.key}>{children}</View>
      ),
      tr: (node: { key: string; index: number }, children: React.ReactNode) => (
        <View
          key={node.key}
          style={[
            styles.tableRow,
            darkMode && styles.tableRowDark,
            node.index % 2 === 1 && styles.tableRowAlternate,
            darkMode && node.index % 2 === 1 && styles.tableRowAlternateDark,
          ]}
        >
          {children}
        </View>
      ),
      th: (
        node: { key: string; index: number },
        children: React.ReactNode,
        parents: { children?: unknown[] }[],
      ) => {
        const count = parents[0]?.children?.length || 1;
        return (
          <View
            key={node.key}
            style={[
              styles.tableCell,
              styles.tableHeaderCell,
              darkMode && styles.tableCellDark,
              { width: tableColumnWidth(node.index, count) },
            ]}
          >
            {children}
          </View>
        );
      },
      td: (
        node: { key: string; index: number },
        children: React.ReactNode,
        parents: { children?: unknown[] }[],
      ) => {
        const count = parents[0]?.children?.length || 1;
        return (
          <View
            key={node.key}
            style={[
              styles.tableCell,
              darkMode && styles.tableCellDark,
              { width: tableColumnWidth(node.index, count) },
            ]}
          >
            {children}
          </View>
        );
      },
    }),
    [darkMode],
  );

  return (
    <Markdown
      markdownit={markdownParser}
      rules={rules}
      style={markdownStyles}
      onLinkPress={(url) => {
        void Linking.openURL(url);
        return false;
      }}
    >
      {content}
    </Markdown>
  );
}

// Reader chrome (progress, outline, and focus controls) can update without
// reparsing and reconciling the full Markdown document.
export const MarkdownRenderer = React.memo(MarkdownRendererComponent);

const styles = StyleSheet.create({
  tableShell: {
    width: '100%',
    marginVertical: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.md,
    backgroundColor: colors.paperStrong,
    overflow: 'hidden',
  },
  tableShellDark: {
    borderColor: '#39423D',
    backgroundColor: '#181E1A',
  },
  tableHint: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: '#F7F6F1',
  },
  tableHintDark: {
    borderBottomColor: '#39423D',
    backgroundColor: '#202822',
  },
  tableHintLabel: {
    color: colors.moss,
    fontFamily: fonts.semibold,
    fontSize: 8,
    letterSpacing: 1.1,
  },
  tableHintLabelDark: {
    color: '#B9D7C4',
  },
  tableHintCopy: {
    color: colors.inkFaint,
    fontFamily: fonts.medium,
    fontSize: 9.5,
  },
  tableHintCopyDark: {
    color: '#909B94',
  },
  tableScrollContent: {
    minWidth: '100%',
  },
  tableHead: {
    backgroundColor: colors.sand,
  },
  tableHeadDark: {
    backgroundColor: '#26312A',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  tableRowDark: {
    borderBottomColor: '#333C36',
  },
  tableRowAlternate: {
    backgroundColor: '#FAF9F6',
  },
  tableRowAlternateDark: {
    backgroundColor: '#161B18',
  },
  tableCell: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
  },
  tableCellDark: {
    borderRightColor: '#333C36',
  },
  tableHeaderCell: {
    minHeight: 45,
    paddingVertical: 8,
  },
});
