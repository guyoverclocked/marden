import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import Storage from '@react-native-async-storage/async-storage';
import {
  ALargeSmall,
  ChevronLeft,
  ListTree,
  Maximize2,
  Minimize2,
  Moon,
  Star,
  Sun,
  X,
} from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { colors, fonts, radii, shadow } from '../theme';
import { MarkdownDocument, TextScale } from '../types';
import { extractHeadings, formatRelativeDate, readMinutes } from '../utils/markdown';

type ReaderScreenProps = {
  document: MarkdownDocument;
  onBack: () => void;
  onToggleFavorite: () => void;
  onProgress: (progress: number) => void;
};

const scales: TextScale[] = ['compact', 'comfortable', 'large'];
const READER_THEME_KEY = 'marden.reader.dark.v1';
const READER_SCALE_KEY = 'marden.reader.scale.v1';

export function ReaderScreen({ document, onBack, onToggleFavorite, onProgress }: ReaderScreenProps) {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const scrollRef = useRef<ScrollView>(null);
  const restoredRef = useRef(false);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const [progress, setProgress] = useState(document.readingProgress);
  const [textScale, setTextScale] = useState<TextScale>('comfortable');
  const [focusMode, setFocusMode] = useState(false);
  const [darkMode, setDarkMode] = useState(systemColorScheme === 'dark');
  const [outlineOpen, setOutlineOpen] = useState(false);
  const headings = useMemo(() => extractHeadings(document.content), [document.content]);

  useEffect(() => {
    restoredRef.current = false;
    setProgress(document.readingProgress);
  }, [document.id, document.readingProgress]);

  useEffect(() => {
    Storage.multiGet([READER_THEME_KEY, READER_SCALE_KEY]).then((entries) => {
      const theme = entries.find(([key]) => key === READER_THEME_KEY)?.[1];
      const scale = entries.find(([key]) => key === READER_SCALE_KEY)?.[1] as TextScale | null | undefined;
      if (theme !== null && theme !== undefined) setDarkMode(theme === 'true');
      if (scale && scales.includes(scale)) setTextScale(scale);
    });
  }, []);

  const restorePosition = () => {
    if (restoredRef.current || document.readingProgress <= 0 || contentHeightRef.current <= viewportHeightRef.current) {
      return;
    }
    restoredRef.current = true;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: document.readingProgress * (contentHeightRef.current - viewportHeightRef.current),
        animated: false,
      });
    });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    contentHeightRef.current = contentSize.height;
    viewportHeightRef.current = layoutMeasurement.height;
    const available = Math.max(1, contentSize.height - layoutMeasurement.height);
    const next = Math.min(1, Math.max(0, contentOffset.y / available));
    setProgress(next);
    onProgress(next);
  };

  const cycleScale = () => {
    const index = scales.indexOf(textScale);
    const nextScale = scales[(index + 1) % scales.length];
    setTextScale(nextScale);
    void Storage.setItem(READER_SCALE_KEY, nextScale);
    void Haptics.selectionAsync();
  };

  const toggleFocus = () => {
    setFocusMode((current) => !current);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleDarkMode = () => {
    setDarkMode((current) => {
      const next = !current;
      void Storage.setItem(READER_THEME_KEY, String(next));
      return next;
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const jumpToHeading = (sourceOffset: number) => {
    const fraction = sourceOffset / Math.max(1, document.content.length);
    const target = fraction * Math.max(0, contentHeightRef.current - viewportHeightRef.current);
    setOutlineOpen(false);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: target, animated: true }));
    void Haptics.selectionAsync();
  };

  return (
    <SafeAreaView
      edges={focusMode ? ['top', 'bottom'] : ['top']}
      style={[styles.safeArea, darkMode && styles.safeAreaDark]}
    >
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      {!focusMode ? (
        <View style={[styles.header, darkMode && styles.headerDark]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to library"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <ChevronLeft size={24} color={darkMode ? '#E9ECE7' : colors.ink} strokeWidth={2} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>
              {document.title}
            </Text>
            <Text style={[styles.headerFileName, darkMode && styles.headerFileNameDark]}>{document.fileName}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={document.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            hitSlop={8}
            onPress={onToggleFavorite}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Star
              size={20}
              color={document.isFavorite ? (darkMode ? '#B9D7C4' : colors.moss) : darkMode ? '#A3ADA6' : colors.inkSoft}
              fill={document.isFavorite ? colors.lime : 'transparent'}
            />
          </Pressable>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                darkMode && styles.progressFillDark,
                { width: `${Math.max(1.5, progress * 100)}%` },
              ]}
            />
          </View>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.readerScroll, focusMode && styles.readerScrollFocus]}
        onContentSizeChange={(_, height) => {
          contentHeightRef.current = height;
          restorePosition();
        }}
        onLayout={(event) => {
          viewportHeightRef.current = event.nativeEvent.layout.height;
          restorePosition();
        }}
        onScroll={handleScroll}
        scrollEventThrottle={80}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.paper}>
          <View style={styles.readerMeta}>
            <View style={[styles.fileBadge, darkMode && styles.fileBadgeDark]}>
              <Text style={[styles.fileBadgeText, darkMode && styles.fileBadgeTextDark]}>MARKDOWN</Text>
            </View>
            <Text style={[styles.metaText, darkMode && styles.metaTextDark]}>
              {readMinutes(document.wordCount)} min read
            </Text>
            <View style={[styles.metaDot, darkMode && styles.metaDotDark]} />
            <Text style={[styles.metaText, darkMode && styles.metaTextDark]}>
              Opened {formatRelativeDate(document.lastOpenedAt).toLowerCase()}
            </Text>
          </View>
          <MarkdownRenderer content={document.content} textScale={textScale} darkMode={darkMode} />
          <View style={styles.endMark}>
            <View style={[styles.endLine, darkMode && styles.endLineDark]} />
            <Text style={[styles.endGlyph, darkMode && styles.endGlyphDark]}>M↓</Text>
            <View style={[styles.endLine, darkMode && styles.endLineDark]} />
          </View>
        </View>
      </ScrollView>

      {focusMode ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit focus mode"
          onPress={toggleFocus}
          style={({ pressed }) => [styles.exitFocus, { top: insets.top + 10 }, pressed && styles.pressed]}
        >
          <Minimize2 size={18} color={darkMode ? '#E9ECE7' : colors.ink} />
        </Pressable>
      ) : (
        <BlurView
          intensity={82}
          tint={darkMode ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
          style={[styles.toolbarShell, darkMode && styles.toolbarShellDark, { bottom: insets.bottom + 12 }]}
        >
          <ReaderTool label="Outline" darkMode={darkMode} onPress={() => setOutlineOpen(true)}>
            <ListTree size={20} color={darkMode ? '#BAC4BD' : colors.inkSoft} />
          </ReaderTool>
          <View style={styles.toolbarDivider} />
          <ReaderTool
            label={textScale === 'large' ? 'Large' : textScale === 'compact' ? 'Compact' : 'Type'}
            darkMode={darkMode}
            onPress={cycleScale}
          >
            <ALargeSmall size={21} color={darkMode ? '#BAC4BD' : colors.inkSoft} />
          </ReaderTool>
          <View style={styles.toolbarDivider} />
          <ReaderTool label={darkMode ? 'Light' : 'Dark'} darkMode={darkMode} onPress={toggleDarkMode}>
            {darkMode ? <Sun size={19} color="#D7E9A2" /> : <Moon size={19} color={colors.inkSoft} />}
          </ReaderTool>
          <View style={styles.toolbarDivider} />
          <ReaderTool label="Focus" darkMode={darkMode} onPress={toggleFocus}>
            <Maximize2 size={19} color={darkMode ? '#BAC4BD' : colors.inkSoft} />
          </ReaderTool>
        </BlurView>
      )}

      <Modal animationType="slide" transparent visible={outlineOpen} onRequestClose={() => setOutlineOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOutlineOpen(false)} />
          <SafeAreaView edges={['bottom']} style={[styles.outlineSheet, darkMode && styles.outlineSheetDark]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetEyebrow, darkMode && styles.sheetEyebrowDark]}>DOCUMENT</Text>
                <Text style={[styles.sheetTitle, darkMode && styles.sheetTitleDark]}>Outline</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close outline"
                onPress={() => setOutlineOpen(false)}
                style={({ pressed }) => [styles.closeButton, darkMode && styles.closeButtonDark, pressed && styles.pressed]}
              >
                <X size={19} color={darkMode ? '#E9ECE7' : colors.ink} />
              </Pressable>
            </View>
            <ScrollView style={styles.outlineScroll} showsVerticalScrollIndicator={false}>
              {headings.length > 0 ? (
                headings.map((heading, index) => (
                  <Pressable
                    key={`${heading.sourceOffset}-${index}`}
                    onPress={() => jumpToHeading(heading.sourceOffset)}
                    style={({ pressed }) => [
                      styles.outlineRow,
                      darkMode && styles.outlineRowDark,
                      { paddingLeft: 17 + Math.max(0, heading.level - 1) * 14 },
                      pressed && styles.outlineRowPressed,
                    ]}
                  >
                    <Text style={[styles.outlineIndex, darkMode && styles.outlineIndexDark]}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                    <Text numberOfLines={2} style={[styles.outlineTitle, darkMode && styles.outlineTitleDark]}>
                      {heading.title}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.noHeadings, darkMode && styles.noHeadingsDark]}>
                  This document has no headings yet.
                </Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type ReaderToolProps = {
  label: string;
  onPress: () => void;
  darkMode: boolean;
  children: React.ReactNode;
};

function ReaderTool({ label, onPress, darkMode, children }: ReaderToolProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolButton,
        pressed && styles.toolPressed,
        pressed && darkMode && styles.toolPressedDark,
      ]}
    >
      {children}
      <Text style={[styles.toolLabel, darkMode && styles.toolLabelDark]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  safeAreaDark: {
    backgroundColor: '#141816',
  },
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    backgroundColor: 'rgba(251,250,247,0.97)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    zIndex: 2,
  },
  headerDark: {
    backgroundColor: 'rgba(20,24,22,0.98)',
    borderBottomColor: '#303833',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.58,
    transform: [{ scale: 0.95 }],
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    maxWidth: '100%',
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 13.5,
  },
  headerTitleDark: {
    color: '#E9ECE7',
  },
  headerFileName: {
    marginTop: 2,
    color: colors.inkFaint,
    fontFamily: fonts.regular,
    fontSize: 9.5,
  },
  headerFileNameDark: {
    color: '#89948D',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: 2,
    backgroundColor: 'transparent',
  },
  progressFill: {
    height: 2,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.moss,
  },
  progressFillDark: {
    backgroundColor: '#B7D7C2',
  },
  readerScroll: {
    paddingHorizontal: 23,
    paddingTop: 29,
    paddingBottom: 132,
  },
  readerScrollFocus: {
    paddingTop: 37,
    paddingBottom: 55,
  },
  paper: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  readerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  fileBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.mossSoft,
  },
  fileBadgeDark: {
    backgroundColor: '#26372F',
  },
  fileBadgeText: {
    color: colors.moss,
    fontFamily: fonts.semibold,
    fontSize: 8,
    letterSpacing: 0.85,
  },
  fileBadgeTextDark: {
    color: '#B9D7C4',
  },
  metaText: {
    color: colors.inkFaint,
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  metaTextDark: {
    color: '#8F9A93',
  },
  metaDot: {
    width: 3,
    height: 3,
    marginHorizontal: 7,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  metaDotDark: {
    backgroundColor: '#404A44',
  },
  endMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 44,
    marginBottom: 10,
  },
  endLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  endLineDark: {
    backgroundColor: '#303833',
  },
  endGlyph: {
    color: colors.moss,
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: -0.5,
  },
  endGlyphDark: {
    color: '#A8CAB4',
  },
  toolbarShell: {
    position: 'absolute',
    left: 25,
    right: 25,
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    overflow: 'hidden',
    ...shadow.floating,
  },
  toolbarShellDark: {
    borderColor: 'rgba(72,84,76,0.76)',
  },
  toolButton: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 18,
  },
  toolPressed: {
    backgroundColor: 'rgba(49,92,74,0.08)',
  },
  toolPressedDark: {
    backgroundColor: 'rgba(185,215,196,0.1)',
  },
  toolLabel: {
    color: colors.inkSoft,
    fontFamily: fonts.medium,
    fontSize: 8.5,
  },
  toolLabelDark: {
    color: '#B3BDB6',
  },
  toolbarDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(28,33,30,0.08)',
  },
  exitFocus: {
    position: 'absolute',
    right: 15,
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20,24,21,0.34)',
  },
  outlineSheet: {
    maxHeight: '76%',
    minHeight: 390,
    paddingTop: 10,
    paddingHorizontal: 19,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.paper,
  },
  outlineSheetDark: {
    backgroundColor: '#181D1A',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    marginBottom: 18,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetEyebrow: {
    marginBottom: 3,
    color: colors.moss,
    fontFamily: fonts.semibold,
    fontSize: 8.5,
    letterSpacing: 1.25,
  },
  sheetEyebrowDark: {
    color: '#A8CAB4',
  },
  sheetTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 24,
    letterSpacing: -0.7,
  },
  sheetTitleDark: {
    color: '#E9ECE7',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sand,
  },
  closeButtonDark: {
    backgroundColor: '#29312C',
  },
  outlineScroll: {
    marginHorizontal: -2,
  },
  outlineRow: {
    minHeight: 59,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  outlineRowDark: {
    borderBottomColor: '#303833',
  },
  outlineRowPressed: {
    backgroundColor: colors.mossSoft,
  },
  outlineIndex: {
    width: 32,
    color: colors.inkFaint,
    fontFamily: fonts.mono,
    fontSize: 9,
  },
  outlineIndexDark: {
    color: '#7F8A83',
  },
  outlineTitle: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  outlineTitleDark: {
    color: '#E1E6E2',
  },
  noHeadings: {
    marginTop: 35,
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  noHeadingsDark: {
    color: '#A1ABA4',
  },
});
