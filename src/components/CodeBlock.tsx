import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '../theme';

type CodeBlockProps = {
  code: string;
  language?: string;
  darkMode?: boolean;
};

const normalizeCode = (value: string) => value.replace(/\r\n?/g, '\n').replace(/\n$/, '');

export function CodeBlock({ code, language, darkMode = false }: CodeBlockProps) {
  const lines = useMemo(() => normalizeCode(code).split('\n'), [code]);
  const label = language?.trim().toUpperCase() || 'CODE';

  return (
    <View style={[styles.shell, darkMode && styles.shellDark]}>
      <View style={styles.header}>
        <Text style={styles.language}>{label}</Text>
        <Text style={styles.lineCount}>{lines.length} {lines.length === 1 ? 'LINE' : 'LINES'}</Text>
      </View>
      <View style={styles.codeRow}>
        <View style={[styles.gutter, darkMode && styles.gutterDark]} accessibilityElementsHidden>
          {lines.map((_, index) => (
            <Text key={index} style={styles.lineNumber}>{index + 1}</Text>
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
              <Text key={index} selectable style={styles.codeText}>{line || '\u00A0'}</Text>
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
