import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Clock3, Folder, MoreHorizontal, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MarkdownDocument } from '../types';
import { colors, darkColors, fonts, radii, shadow } from '../theme';
import { formatRelativeDate, previewFromMarkdown, readMinutes } from '../utils/markdown';

type DocumentCardProps = {
  document: MarkdownDocument;
  projectName?: string;
  darkMode?: boolean;
  desktop?: boolean;
  onPress: () => void;
  onMenu: () => void;
};

const coverPalettes: [string, string][] = [
  ['#2F5B49', '#183C30'],
  ['#6B5541', '#3F3025'],
  ['#4B596C', '#293544'],
  ['#6A4950', '#442D33'],
];

const paletteFor = (id: string) => {
  const index = id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0) % coverPalettes.length;
  return coverPalettes[index];
};

export function DocumentCard({ document, projectName, darkMode = false, desktop = false, onPress, onMenu }: DocumentCardProps) {
  const progress = Math.round(document.readingProgress * 100);
  const theme = darkMode ? darkColors : colors;

  return (
    <View style={[styles.card, darkMode && styles.cardDark, desktop && styles.cardDesktop]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${document.title}`}
        onPress={onPress}
        style={({ pressed }) => [styles.mainPressable, pressed && styles.cardPressed]}
      >
        <LinearGradient colors={paletteFor(document.id)} style={styles.cover}>
          <View style={styles.coverTopRow}>
            <Text style={styles.mdLabel}>MD</Text>
            {document.isFavorite ? <Star size={15} color={colors.lime} fill={colors.lime} /> : null}
          </View>
          <Text style={styles.coverGlyph}>M↓</Text>
          <View style={styles.coverLine} />
          <View style={[styles.coverLine, styles.coverLineShort]} />
        </LinearGradient>

        <View style={styles.content}>
          <Text numberOfLines={2} style={[styles.title, darkMode && styles.titleDark]}>
            {document.title}
          </Text>

          {projectName ? (
            <View style={[styles.projectLabel, darkMode && styles.projectLabelDark]}>
              <Folder size={10} color={theme.moss} />
              <Text numberOfLines={1} style={[styles.projectLabelText, darkMode && styles.projectLabelTextDark]}>
                {projectName}
              </Text>
            </View>
          ) : null}

          <Text numberOfLines={2} style={[styles.preview, darkMode && styles.previewDark]}>
            {previewFromMarkdown(document.content)}
          </Text>

          <View style={styles.metaRow}>
            <Clock3 size={13} color={theme.inkFaint} />
            <Text style={[styles.metaText, darkMode && styles.metaTextDark]}>{readMinutes(document.wordCount)} min</Text>
            <View style={[styles.metaDot, darkMode && styles.metaDotDark]} />
            <Text style={[styles.metaText, darkMode && styles.metaTextDark]}>{formatRelativeDate(document.lastOpenedAt)}</Text>
            {progress > 0 ? (
              <>
                <View style={[styles.metaDot, darkMode && styles.metaDotDark]} />
                <Text style={[styles.progressText, darkMode && styles.progressTextDark]}>{progress}% read</Text>
              </>
            ) : null}
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More actions for ${document.title}`}
        hitSlop={8}
        onPress={onMenu}
        style={({ pressed }) => [styles.menuButton, pressed && styles.iconPressed]}
      >
        <MoreHorizontal size={20} color={theme.inkSoft} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 158,
    padding: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: 'rgba(28, 33, 30, 0.055)',
    ...shadow.card,
  },
  mainPressable: {
    flex: 1,
    flexDirection: 'row',
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.988 }],
  },
  cover: {
    width: 104,
    borderRadius: 17,
    padding: 14,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  coverTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mdLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  coverGlyph: {
    marginTop: 12,
    color: colors.paper,
    fontFamily: fonts.bold,
    fontSize: 29,
    letterSpacing: -2,
  },
  coverLine: {
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  coverLineShort: {
    width: '62%',
    marginTop: -8,
  },
  content: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingLeft: 15,
    paddingRight: 32,
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.25,
  },
  menuButton: {
    position: 'absolute',
    top: 14,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: {
    backgroundColor: colors.sand,
  },
  preview: {
    marginTop: 8,
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  projectLabel: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '90%',
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.mossSoft,
  },
  projectLabelText: {
    flexShrink: 1,
    color: colors.moss,
    fontFamily: fonts.semibold,
    fontSize: 8.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 11,
  },
  metaText: {
    marginLeft: 4,
    color: colors.inkFaint,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  metaDot: {
    width: 3,
    height: 3,
    marginHorizontal: 7,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  progressText: {
    color: colors.moss,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  cardDark: {
    backgroundColor: darkColors.paperStrong,
    borderColor: darkColors.line,
  },
  cardDesktop: {
    width: '48.9%',
  },
  titleDark: {
    color: darkColors.ink,
  },
  previewDark: {
    color: darkColors.inkSoft,
  },
  projectLabelDark: {
    backgroundColor: darkColors.mossSoft,
  },
  projectLabelTextDark: {
    color: darkColors.moss,
  },
  metaTextDark: {
    color: darkColors.inkFaint,
  },
  metaDotDark: {
    backgroundColor: darkColors.lineStrong,
  },
  progressTextDark: {
    color: darkColors.moss,
  },
});
