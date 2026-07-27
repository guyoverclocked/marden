import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Bold,
  Check,
  ChevronDown,
  Code2,
  Eye,
  Heading1,
  Highlighter,
  Italic,
  Link2,
  List,
  Moon,
  PencilLine,
  Sparkles,
  Sun,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { colors, darkColors, fonts, radii, shadow } from '../theme';
import { MarkdownDocument, Project } from '../types';
import { titleFromMarkdown, wordCount } from '../utils/markdown';

type EditorScreenProps = {
  projects: Project[];
  document?: MarkdownDocument | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onCancel: () => void;
  onSave: (title: string, content: string, projectId: string | null) => boolean;
};

type EditorMode = 'edit' | 'preview';

export function EditorScreen({
  projects,
  document,
  darkMode,
  onToggleDarkMode,
  onCancel,
  onSave,
}: EditorScreenProps) {
  const { width: windowWidth } = useWindowDimensions();
  const desktop = windowWidth >= 900;
  const editorRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [title, setTitle] = useState(document?.title || '');
  const [content, setContent] = useState(document?.content || '');
  const [projectId, setProjectId] = useState<string | null>(document?.projectId || null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const selectedProject = projects.find((project) => project.id === projectId);
  const theme = darkMode ? darkColors : colors;
  const count = useMemo(() => wordCount(content), [content]);
  const canSave = content.trim().length > 0;
  const isDirty = document
    ? title !== document.title || content !== document.content || projectId !== document.projectId
    : Boolean(content.trim() || title.trim());

  const insert = (before: string, after: string, placeholder: string) => {
    const selected = content.slice(selection.start, selection.end);
    const value = selected || placeholder;
    const nextContent = `${content.slice(0, selection.start)}${before}${value}${after}${content.slice(selection.end)}`;
    const nextStart = selection.start + before.length;
    setContent(nextContent);
    setSelection({ start: nextStart, end: nextStart + value.length });
    requestAnimationFrame(() => editorRef.current?.focus());
    void Haptics.selectionAsync();
  };

  const addLinePrefix = (prefix: string, placeholder: string) => {
    const lineStart = content.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
    const nextContent = `${content.slice(0, lineStart)}${prefix}${content.slice(lineStart) || placeholder}`;
    setContent(nextContent);
    const cursor = lineStart + prefix.length;
    setSelection({ start: cursor, end: cursor });
    requestAnimationFrame(() => editorRef.current?.focus());
    void Haptics.selectionAsync();
  };

  const save = () => {
    if (!canSave) return;
    const resolvedTitle = title.trim() || titleFromMarkdown(content, 'Untitled.md');
    if (onSave(resolvedTitle, content, projectId)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const requestCancel = () => {
    if (!isDirty) {
      onCancel();
      return;
    }
    setDiscardConfirmOpen(true);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, darkMode && styles.safeAreaDark]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.flex}
      >
        <View style={[styles.header, darkMode && styles.headerDark]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel editor"
            onPress={requestCancel}
            style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
          >
            <X size={20} color={theme.ink} />
            <Text style={[styles.cancelText, darkMode && styles.cancelTextDark]}>Cancel</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerEyebrow, darkMode && styles.headerEyebrowDark]}>{document ? 'EDIT MARKDOWN' : 'NEW MARKDOWN'}</Text>
            <Text style={[styles.headerTitle, darkMode && styles.headerTitleDark]}>{document ? 'Edit in Marden' : 'Write in Marden'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={darkMode ? 'Use light writing mode' : 'Use night writing mode'}
            onPress={onToggleDarkMode}
            style={({ pressed }) => [styles.themeButton, darkMode && styles.themeButtonDark, pressed && styles.pressed]}
          >
            {darkMode ? <Sun size={18} color="#D7E9A2" /> : <Moon size={18} color={colors.inkSoft} />}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save Markdown"
            disabled={!canSave}
            onPress={save}
            style={({ pressed }) => [
              styles.saveButton,
              darkMode && styles.saveButtonDark,
              !canSave && styles.saveButtonDisabled,
              darkMode && !canSave && styles.saveButtonDisabledDark,
              pressed && styles.pressed,
            ]}
          >
            <Check size={17} color={canSave ? colors.paper : theme.inkFaint} />
            <Text style={[styles.saveText, darkMode && styles.saveTextDark, !canSave && styles.saveTextDisabled]}>Save</Text>
          </Pressable>
        </View>

        <View style={[styles.segmentedControl, darkMode && styles.segmentedControlDark, desktop && styles.segmentedControlDesktop]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit Markdown"
            onPress={() => setMode('edit')}
            style={[styles.segment, mode === 'edit' && styles.segmentActive, darkMode && mode === 'edit' && styles.segmentActiveDark]}
          >
            <PencilLine size={15} color={mode === 'edit' ? colors.paper : theme.inkSoft} />
            <Text style={[styles.segmentText, darkMode && styles.segmentTextDark, mode === 'edit' && styles.segmentTextActive]}>Edit</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Preview Markdown"
            onPress={() => setMode('preview')}
            style={[styles.segment, mode === 'preview' && styles.segmentActive, darkMode && mode === 'preview' && styles.segmentActiveDark]}
          >
            <Eye size={15} color={mode === 'preview' ? colors.paper : theme.inkSoft} />
            <Text style={[styles.segmentText, darkMode && styles.segmentTextDark, mode === 'preview' && styles.segmentTextActive]}>Preview</Text>
          </Pressable>
        </View>

        {mode === 'edit' ? (
          <View style={[styles.editorLayout, desktop && styles.editorLayoutDesktop]}>
            <View style={[styles.aiHint, darkMode && styles.aiHintDark]}>
              <View style={[styles.aiHintIcon, darkMode && styles.aiHintIconDark]}>
                <Sparkles size={15} color={theme.moss} />
              </View>
              <Text style={[styles.aiHintText, darkMode && styles.aiHintTextDark]}>
                Paste from any AI app: long-press in the editor, then choose <Text style={[styles.aiHintStrong, darkMode && styles.aiHintStrongDark]}>Paste</Text>.
              </Text>
            </View>

            <View style={styles.metaRow}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                accessibilityLabel="Document title"
                placeholder="Document title (optional)"
                placeholderTextColor={theme.inkFaint}
                selectionColor={theme.moss}
                style={[styles.titleInput, darkMode && styles.titleInputDark]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose project"
                onPress={() => setProjectPickerOpen(true)}
                style={({ pressed }) => [styles.projectButton, darkMode && styles.projectButtonDark, pressed && styles.pressed]}
              >
                <View style={[styles.projectDot, { backgroundColor: selectedProject?.color || colors.lineStrong }]} />
                <Text numberOfLines={1} style={[styles.projectButtonText, darkMode && styles.projectButtonTextDark]}>
                  {selectedProject?.name || 'Unfiled'}
                </Text>
                <ChevronDown size={14} color={theme.inkSoft} />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              style={styles.formatScroll}
              keyboardShouldPersistTaps="always"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.formatBar}
            >
              <FormatButton darkMode={darkMode} label="Heading" onPress={() => addLinePrefix('# ', 'Heading')}>
                <Heading1 size={17} color={theme.inkSoft} />
              </FormatButton>
              <FormatButton darkMode={darkMode} label="Bold" onPress={() => insert('**', '**', 'bold text')}>
                <Bold size={17} color={theme.inkSoft} />
              </FormatButton>
              <FormatButton darkMode={darkMode} label="Italic" onPress={() => insert('_', '_', 'emphasis')}>
                <Italic size={17} color={theme.inkSoft} />
              </FormatButton>
              <FormatButton darkMode={darkMode} label="Highlight" onPress={() => insert('==', '==', 'important text')}>
                <Highlighter size={17} color={theme.inkSoft} />
              </FormatButton>
              <FormatButton darkMode={darkMode} label="List" onPress={() => addLinePrefix('- ', 'List item')}>
                <List size={17} color={theme.inkSoft} />
              </FormatButton>
              <FormatButton darkMode={darkMode} label="Link" onPress={() => insert('[', '](https://)', 'link text')}>
                <Link2 size={17} color={theme.inkSoft} />
              </FormatButton>
              <FormatButton darkMode={darkMode} label="Code" onPress={() => insert('```\n', '\n```', 'code')}>
                <Code2 size={17} color={theme.inkSoft} />
              </FormatButton>
            </ScrollView>

            <View style={[styles.editorCard, darkMode && styles.editorCardDark]}>
              <TextInput
                ref={editorRef}
                autoCapitalize="sentences"
                autoCorrect={false}
                multiline
                value={content}
                onChangeText={setContent}
                onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
                placeholder={'# Start writing\n\nType Markdown here, or paste a response from your favourite AI app…'}
                placeholderTextColor={darkMode ? '#829087' : '#929A94'}
                selection={selection}
                selectionColor={colors.lime}
                textAlignVertical="top"
                style={styles.editorInput}
              />
              <View style={styles.editorFooter}>
                <Text style={styles.editorFooterText}>MARKDOWN</Text>
                <Text style={styles.editorFooterText}>{count} words</Text>
              </View>
            </View>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.previewScroll, desktop && styles.previewScrollDesktop]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.previewMeta}>
              <View>
                <Text style={[styles.previewEyebrow, darkMode && styles.previewEyebrowDark]}>LIVE PREVIEW</Text>
                <Text style={[styles.previewTitle, darkMode && styles.previewTitleDark]}>{title.trim() || titleFromMarkdown(content, 'Untitled.md')}</Text>
              </View>
              <View style={[styles.wordBadge, darkMode && styles.wordBadgeDark]}>
                <Text style={[styles.wordBadgeText, darkMode && styles.wordBadgeTextDark]}>{count} words</Text>
              </View>
            </View>
            {content.trim() ? (
              <MarkdownRenderer content={content} textScale="comfortable" darkMode={darkMode} />
            ) : (
              <View style={[styles.emptyPreview, darkMode && styles.emptyPreviewDark]}>
                <Eye size={24} color={theme.moss} />
                <Text style={[styles.emptyPreviewTitle, darkMode && styles.emptyPreviewTitleDark]}>Your preview will appear here</Text>
                <Text style={[styles.emptyPreviewText, darkMode && styles.emptyPreviewTextDark]}>Switch to Edit and add or paste some Markdown.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <Modal
        animationType="fade"
        transparent
        visible={discardConfirmOpen}
        onRequestClose={() => setDiscardConfirmOpen(false)}
      >
          <View style={styles.discardModalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDiscardConfirmOpen(false)} />
          <View style={[styles.discardCard, darkMode && styles.discardCardDark]}>
            <View style={[styles.discardIcon, darkMode && styles.discardIconDark]}>
              <X size={22} color={colors.error} />
            </View>
            <Text style={[styles.discardTitle, darkMode && styles.discardTitleDark]}>{document ? 'Discard your changes?' : 'Discard this draft?'}</Text>
            <Text style={[styles.discardBody, darkMode && styles.discardBodyDark]}>{document ? 'The saved document will stay unchanged.' : 'Your unsaved Markdown will be lost.'}</Text>
            <View style={styles.discardActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Keep writing"
                onPress={() => setDiscardConfirmOpen(false)}
                style={({ pressed }) => [styles.keepWritingButton, pressed && styles.pressed]}
              >
                <Text style={[styles.keepWritingText, darkMode && styles.keepWritingTextDark]}>Keep writing</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Discard draft"
                onPress={() => {
                  setDiscardConfirmOpen(false);
                  onCancel();
                }}
                style={({ pressed }) => [styles.discardButton, pressed && styles.pressed]}
              >
                <Text style={styles.discardButtonText}>Discard</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={projectPickerOpen}
        onRequestClose={() => setProjectPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setProjectPickerOpen(false)} />
          <SafeAreaView edges={['bottom']} style={[styles.projectSheet, darkMode && styles.projectSheetDark]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetEyebrow, darkMode && styles.sheetEyebrowDark]}>ORGANIZE</Text>
            <Text style={[styles.sheetTitle, darkMode && styles.sheetTitleDark]}>Choose a project</Text>
            <ProjectChoice
              name="Unfiled"
              color={colors.lineStrong}
              selected={projectId === null}
              darkMode={darkMode}
              onPress={() => {
                setProjectId(null);
                setProjectPickerOpen(false);
              }}
            />
            {projects.map((project) => (
              <ProjectChoice
                key={project.id}
                name={project.name}
                color={project.color}
                selected={projectId === project.id}
                darkMode={darkMode}
                onPress={() => {
                  setProjectId(project.id);
                  setProjectPickerOpen(false);
                }}
              />
            ))}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FormatButton({
  label,
  onPress,
  children,
  darkMode,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  darkMode: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Insert ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.formatButton, darkMode && styles.formatButtonDark, pressed && styles.formatButtonPressed]}
    >
      {children}
      <Text style={[styles.formatLabel, darkMode && styles.formatLabelDark]}>{label}</Text>
    </Pressable>
  );
}

function ProjectChoice({
  name,
  color,
  selected,
  darkMode,
  onPress,
}: {
  name: string;
  color: string;
  selected: boolean;
  darkMode: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Choose ${name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.projectChoice, darkMode && styles.projectChoiceDark, pressed && styles.projectChoicePressed]}
    >
      <View style={[styles.choiceDot, { backgroundColor: color }]} />
      <Text style={[styles.choiceName, darkMode && styles.choiceNameDark]}>{name}</Text>
      {selected ? <Check size={18} color={darkMode ? darkColors.moss : colors.moss} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  safeAreaDark: { backgroundColor: darkColors.canvas },
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.paper,
  },
  headerDark: { borderBottomColor: darkColors.line, backgroundColor: darkColors.paper },
  headerAction: {
    width: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pressed: { opacity: 0.55, transform: [{ scale: 0.97 }] },
  cancelText: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 11 },
  cancelTextDark: { color: darkColors.inkSoft },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerEyebrow: { color: colors.moss, fontFamily: fonts.semibold, fontSize: 7.5, letterSpacing: 1.15 },
  headerEyebrowDark: { color: darkColors.moss },
  headerTitle: { marginTop: 2, color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
  headerTitleDark: { color: darkColors.ink },
  themeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    borderRadius: 19,
  },
  themeButtonDark: { backgroundColor: darkColors.mossSoft },
  saveButton: {
    minWidth: 78,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.moss,
  },
  saveButtonDisabled: { backgroundColor: colors.line },
  saveButtonDark: { backgroundColor: darkColors.moss },
  saveButtonDisabledDark: { backgroundColor: darkColors.line },
  saveText: { color: colors.paper, fontFamily: fonts.semibold, fontSize: 11 },
  saveTextDark: { color: darkColors.canvas },
  saveTextDisabled: { color: colors.inkFaint },
  segmentedControl: {
    height: 45,
    flexDirection: 'row',
    gap: 5,
    padding: 5,
    marginHorizontal: 20,
    marginTop: 13,
    borderRadius: 15,
    backgroundColor: colors.sand,
  },
  segmentedControlDark: { backgroundColor: darkColors.sand },
  segmentedControlDesktop: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    marginHorizontal: 0,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 11,
  },
  segmentActive: { backgroundColor: colors.moss },
  segmentActiveDark: { backgroundColor: darkColors.mossDark },
  segmentText: { color: colors.inkSoft, fontFamily: fonts.semibold, fontSize: 11 },
  segmentTextDark: { color: darkColors.inkSoft },
  segmentTextActive: { color: colors.paper },
  editorLayout: { flex: 1, paddingHorizontal: 20 },
  editorLayoutDesktop: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 0 },
  aiHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: radii.sm,
    backgroundColor: '#E9F0E8',
  },
  aiHintDark: { backgroundColor: darkColors.mossSoft },
  aiHintIcon: {
    width: 29,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.paperStrong,
  },
  aiHintIconDark: { backgroundColor: darkColors.paperStrong },
  aiHintText: { flex: 1, color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 15 },
  aiHintTextDark: { color: darkColors.inkSoft },
  aiHintStrong: { color: colors.moss, fontFamily: fonts.semibold },
  aiHintStrongDark: { color: darkColors.moss },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13 },
  titleInput: {
    flex: 1,
    height: 45,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    color: colors.ink,
    backgroundColor: colors.paperStrong,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  titleInputDark: { borderColor: darkColors.line, color: darkColors.ink, backgroundColor: darkColors.paperStrong },
  projectButton: {
    maxWidth: 135,
    height: 45,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.paperStrong,
  },
  projectButtonDark: { borderColor: darkColors.line, backgroundColor: darkColors.paperStrong },
  projectDot: { width: 8, height: 8, borderRadius: 4 },
  projectButtonText: { flexShrink: 1, color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 10 },
  projectButtonTextDark: { color: darkColors.inkSoft },
  formatBar: { gap: 7, paddingVertical: 11 },
  // React Native Web's horizontal ScrollView otherwise grows to fill the
  // column, leaving an empty band above the writing card on desktop.
  formatScroll: { flexGrow: 0, flexShrink: 0 },
  formatButton: {
    height: 37,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.paperStrong,
  },
  formatButtonDark: { borderColor: darkColors.line, backgroundColor: darkColors.paperStrong },
  formatButtonPressed: { backgroundColor: colors.mossSoft, borderColor: colors.mossSoft },
  formatLabel: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 9.5 },
  formatLabelDark: { color: darkColors.inkSoft },
  editorCard: {
    flex: 1,
    minHeight: 220,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#29332D',
    borderRadius: radii.md,
    backgroundColor: '#1B211D',
    overflow: 'hidden',
    ...shadow.card,
  },
  editorCardDark: { borderColor: '#39473E', backgroundColor: '#101512' },
  editorInput: {
    flex: 1,
    padding: 17,
    color: '#E8EDE9',
    fontFamily: fonts.mono,
    fontSize: 13.5,
    lineHeight: 22,
  },
  editorFooter: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  editorFooterText: { color: '#819087', fontFamily: fonts.semibold, fontSize: 8, letterSpacing: 0.8 },
  previewScroll: { paddingHorizontal: 23, paddingTop: 24, paddingBottom: 55 },
  previewScrollDesktop: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20 },
  previewMeta: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 13 },
  previewEyebrow: { color: colors.moss, fontFamily: fonts.semibold, fontSize: 8, letterSpacing: 1.2 },
  previewEyebrowDark: { color: darkColors.moss },
  previewTitle: { marginTop: 4, color: colors.ink, fontFamily: fonts.semibold, fontSize: 18 },
  previewTitleDark: { color: darkColors.ink },
  wordBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.mossSoft },
  wordBadgeDark: { backgroundColor: darkColors.mossSoft },
  wordBadgeText: { color: colors.moss, fontFamily: fonts.semibold, fontSize: 9 },
  wordBadgeTextDark: { color: darkColors.moss },
  emptyPreview: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.paperStrong,
  },
  emptyPreviewDark: { borderColor: darkColors.line, backgroundColor: darkColors.paperStrong },
  emptyPreviewTitle: { marginTop: 13, color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  emptyPreviewTitleDark: { color: darkColors.ink },
  emptyPreviewText: { marginTop: 6, color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
  emptyPreviewTextDark: { color: darkColors.inkSoft },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,24,21,0.34)' },
  projectSheet: {
    maxHeight: '72%',
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.paper,
  },
  projectSheetDark: { backgroundColor: darkColors.paper },
  sheetHandle: { width: 38, height: 4, alignSelf: 'center', marginBottom: 18, borderRadius: 2, backgroundColor: colors.lineStrong },
  sheetEyebrow: { color: colors.moss, fontFamily: fonts.semibold, fontSize: 8, letterSpacing: 1.2 },
  sheetEyebrowDark: { color: darkColors.moss },
  sheetTitle: { marginTop: 4, marginBottom: 16, color: colors.ink, fontFamily: fonts.semibold, fontSize: 23 },
  sheetTitleDark: { color: darkColors.ink },
  projectChoice: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  projectChoiceDark: { borderBottomColor: darkColors.line },
  projectChoicePressed: { backgroundColor: colors.mossSoft },
  choiceDot: { width: 12, height: 12, borderRadius: 6, marginRight: 11 },
  choiceName: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 14 },
  choiceNameDark: { color: darkColors.ink },
  discardModalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
    backgroundColor: 'rgba(20,24,21,0.44)',
  },
  discardCard: {
    width: '100%',
    maxWidth: 360,
    padding: 23,
    borderRadius: radii.lg,
    backgroundColor: colors.paperStrong,
    ...shadow.floating,
  },
  discardCardDark: { backgroundColor: darkColors.paperStrong },
  discardIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderRadius: 15,
    backgroundColor: '#F5E5E2',
  },
  discardIconDark: { backgroundColor: '#4A2926' },
  discardTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 20,
    letterSpacing: -0.45,
  },
  discardTitleDark: { color: darkColors.ink },
  discardBody: {
    marginTop: 6,
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  discardBodyDark: { color: darkColors.inkSoft },
  discardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
    marginTop: 22,
  },
  keepWritingButton: {
    height: 43,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  keepWritingText: {
    color: colors.inkSoft,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  keepWritingTextDark: { color: darkColors.inkSoft },
  discardButton: {
    height: 43,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.error,
  },
  discardButtonText: {
    color: colors.paper,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
});
