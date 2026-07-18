import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '../theme';
import { TextScale } from '../types';

type CodeBlockProps = {
  code: string;
  language?: string;
  darkMode?: boolean;
  textScale: TextScale;
};

const normalizeCode = (value: string) => value.replace(/\r\n?/g, '\n').replace(/\n$/, '');

const codeSizes: Record<TextScale, { code: number; line: number; number: number }> = {
  compact: { code: 11.5, line: 19, number: 10.5 },
  comfortable: { code: 12.5, line: 20, number: 11.5 },
  large: { code: 15, line: 24, number: 13.5 },
};

export function CodeBlock({ code, language, darkMode = false, textScale }: CodeBlockProps) {
  const lines = useMemo(() => normalizeCode(code).split('\n'), [code]);
  const label = language?.trim().toUpperCase() || 'CODE';
  const type = codeSizes[textScale];

  return (
    <View style={[styles.shell, darkMode && styles.shellDark]}>
      <View style={styles.header}>
        <Text style={styles.language}>{label}</Text>
        <Text style={styles.lineCount}>{lines.length} {lines.length === 1 ? 'LINE' : 'LINES'}</Text>
      </View>
      <View style={styles.codeRow}>
        <View style={[styles.gutter, darkMode && styles.gutterDark]} accessibilityElementsHidden>
          {lines.map((_, index) => (
            <Text key={index} style={[styles.lineNumber, { fontSize: type.number, lineHeight: type.line }]}>
              {index + 1}
            </Text>
          ))}
        </View>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.scrollContent}
        >
          <View>
            {lines.map((line, index) => (
              <Text key={index} selectable style={[styles.codeText, { fontSize: type.code, lineHeight: type.line }]}>
                {line || '\u00A0'}
              </Text>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    marginVertical: 16,
    borderRadius: radii.md,
    backgroundColor: '#202622',
    overflow: 'hidden',
  },
  shellDark: {
    backgroundColor: '#101512',
    borderWidth: 1,
    borderColor: '#303933',
  },
  header: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.09)',
  },
  language: {
    color: '#AFC4B6',
    fontFamily: fonts.semibold,
    fontSize: 8.5,
    letterSpacing: 1.1,
  },
  lineCount: {
    color: '#718078',
    fontFamily: fonts.semibold,
    fontSize: 7.5,
    letterSpacing: 0.8,
  },
  codeRow: {
    flexDirection: 'row',
  },
  gutter: {
    paddingVertical: 15,
    paddingHorizontal: 11,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#1A201C',
  },
  gutterDark: {
    backgroundColor: '#0D110F',
  },
  lineNumber: {
    minWidth: 17,
    color: '#66736B',
    fontFamily: fonts.mono,
    fontSize: 11.5,
    lineHeight: 20,
    textAlign: 'right',
  },
  scrollContent: {
    minWidth: '100%',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  codeText: {
    color: colors.paperStrong,
    fontFamily: fonts.mono,
    fontSize: 12.5,
    lineHeight: 20,
  },
});
