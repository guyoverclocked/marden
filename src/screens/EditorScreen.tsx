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
  Italic,
  Link2,
  List,
  PencilLine,
  Sparkles,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { colors, fonts, radii, shadow } from '../theme';
import { MarkdownDocument, Project } from '../types';
import { titleFromMarkdown, wordCount } from '../utils/markdown';

type EditorScreenProps = {
  projects: Project[];
  document?: MarkdownDocument | null;
  onCancel: () => void;
  onSave: (title: string, content: string, projectId: string | null) => boolean;
};

type EditorMode = 'edit' | 'preview';

export function EditorScreen({ projects, document, onCancel, onSave }: EditorScreenProps) {
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
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel editor"
            onPress={requestCancel}
            style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
          >
            <X size={20} color={colors.ink} />
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>{document ? 'EDIT MARKDOWN' : 'NEW MARKDOWN'}</Text>
            <Text style={styles.headerTitle}>{document ? 'Edit in Marden' : 'Write in Marden'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save Markdown"
            disabled={!canSave}
            onPress={save}
            style={({ pressed }) => [styles.saveButton, !canSave && styles.saveButtonDisabled, pressed && styles.pressed]}
          >
            <Check size={17} color={canSave ? colors.paper : colors.inkFaint} />
            <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>Save</Text>
          </Pressable>
        </View>

        <View style={[styles.segmentedControl, desktop && styles.segmentedControlDesktop]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit Markdown"
            onPress={() => setMode('edit')}
            style={[styles.segment, mode === 'edit' && styles.segmentActive]}
          >
            <PencilLine size={15} color={mode === 'edit' ? colors.paper : colors.inkSoft} />
            <Text style={[styles.segmentText, mode === 'edit' && styles.segmentTextActive]}>Edit</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Preview Markdown"
            onPress={() => setMode('preview')}
            style={[styles.segment, mode === 'preview' && styles.segmentActive]}
          >
            <Eye size={15} color={mode === 'preview' ? colors.paper : colors.inkSoft} />
            <Text style={[styles.segmentText, mode === 'preview' && styles.segmentTextActive]}>Preview</Text>
          </Pressable>
        </View>

        {mode === 'edit' ? (
          <View style={[styles.editorLayout, desktop && styles.editorLayoutDesktop]}>
            <View style={styles.aiHint}>
              <View style={styles.aiHintIcon}>
                <Sparkles size={15} color={colors.moss} />
              </View>
              <Text style={styles.aiHintText}>
                Paste from any AI app: long-press in the editor, then choose <Text style={styles.aiHintStrong}>Paste</Text>.
              </Text>
            </View>

            <View style={styles.metaRow}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                accessibilityLabel="Document title"
                placeholder="Document title (optional)"
                placeholderTextColor={colors.inkFaint}
                selectionColor={colors.moss}
                style={styles.titleInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose project"
                onPress={() => setProjectPickerOpen(true)}
                style={({ pressed }) => [styles.projectButton, pressed && styles.pressed]}
              >
                <View style={[styles.projectDot, { backgroundColor: selectedProject?.color || colors.lineStrong }]} />
                <Text numberOfLines={1} style={styles.projectButtonText}>
                  {selectedProject?.name || 'Unfiled'}
                </Text>
                <ChevronDown size={14} color={colors.inkSoft} />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              keyboardShouldPersistTaps="always"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.formatBar}
            >
              <FormatButton label="Heading" onPress={() => addLinePrefix('# ', 'Heading')}>
                <Heading1 size={17} color={colors.inkSoft} />
              </FormatButton>
              <FormatButton label="Bold" onPress={() => insert('**', '**', 'bold text')}>
                <Bold size={17} color={colors.inkSoft} />
              </FormatButton>
              <FormatButton label="Italic" onPress={() => insert('_', '_', 'emphasis')}>
                <Italic size={17} color={colors.inkSoft} />
              </FormatButton>
              <FormatButton label="List" onPress={() => addLinePrefix('- ', 'List item')}>
                <List size={17} color={colors.inkSoft} />
              </FormatButton>
              <FormatButton label="Link" onPress={() => insert('[', '](https://)', 'link text')}>
                <Link2 size={17} color={colors.inkSoft} />
              </FormatButton>
              <FormatButton label="Code" onPress={() => insert('```\n', '\n```', 'code')}>
                <Code2 size={17} color={colors.inkSoft} />
              </FormatButton>
            </ScrollView>

            <View style={styles.editorCard}>
              <TextInput
                ref={editorRef}
                autoCapitalize="sentences"
                autoCorrect={false}
                multiline
                value={content}
                onChangeText={setContent}
                onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
                placeholder={'# Start writing\n\nType Markdown here, or paste a response from your favourite AI app…'}
                placeholderTextColor="#929A94"
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
                <Text style={styles.previewEyebrow}>LIVE PREVIEW</Text>
                <Text style={styles.previewTitle}>{title.trim() || titleFromMarkdown(content, 'Untitled.md')}</Text>
              </View>
              <View style={styles.wordBadge}>
                <Text style={styles.wordBadgeText}>{count} words</Text>
              </View>
            </View>
            {content.trim() ? (
              <MarkdownRenderer content={content} textScale="comfortable" />
            ) : (
              <View style={styles.emptyPreview}>
                <Eye size={24} color={colors.moss} />
                <Text style={styles.emptyPreviewTitle}>Your preview will appear here</Text>
                <Text style={styles.emptyPreviewText}>Switch to Edit and add or paste some Markdown.</Text>
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
          <View style={styles.discardCard}>
            <View style={styles.discardIcon}>
              <X size={22} color={colors.error} />
            </View>
            <Text style={styles.discardTitle}>{document ? 'Discard your changes?' : 'Discard this draft?'}</Text>
            <Text style={styles.discardBody}>{document ? 'The saved document will stay unchanged.' : 'Your unsaved Markdown will be lost.'}</Text>
            <View style={styles.discardActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Keep writing"
                onPress={() => setDiscardConfirmOpen(false)}
                style={({ pressed }) => [styles.keepWritingButton, pressed && styles.pressed]}
              >
                <Text style={styles.keepWritingText}>Keep writing</Text>
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
          <SafeAreaView edges={['bottom']} style={styles.projectSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>ORGANIZE</Text>
            <Text style={styles.sheetTitle}>Choose a project</Text>
            <ProjectChoice
              name="Unfiled"
              color={colors.lineStrong}
              selected={projectId === null}
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

function FormatButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Insert ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.formatButton, pressed && styles.formatButtonPressed]}
    >
      {children}
      <Text style={styles.formatLabel}>{label}</Text>
    </Pressable>
  );
}

function ProjectChoice({
  name,
  color,
  selected,
  onPress,
}: {
  name: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Choose ${name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.projectChoice, pressed && styles.projectChoicePressed]}
    >
      <View style={[styles.choiceDot, { backgroundColor: color }]} />
      <Text style={styles.choiceName}>{name}</Text>
      {selected ? <Check size={18} color={colors.moss} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.paper,
  },
  headerAction: {
    width: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pressed: { opacity: 0.55, transform: [{ scale: 0.97 }] },
  cancelText: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 11 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerEyebrow: { color: colors.moss, fontFamily: fonts.semibold, fontSize: 7.5, letterSpacing: 1.15 },
  headerTitle: { marginTop: 2, color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
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
  saveText: { color: colors.paper, fontFamily: fonts.semibold, fontSize: 11 },
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
  segmentText: { color: colors.inkSoft, fontFamily: fonts.semibold, fontSize: 11 },
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
  aiHintIcon: {
    width: 29,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.paperStrong,
  },
  aiHintText: { flex: 1, color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 15 },
  aiHintStrong: { color: colors.moss, fontFamily: fonts.semibold },
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
  projectDot: { width: 8, height: 8, borderRadius: 4 },
  projectButtonText: { flexShrink: 1, color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 10 },
  formatBar: { gap: 7, paddingVertical: 11 },
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
  formatButtonPressed: { backgroundColor: colors.mossSoft, borderColor: colors.mossSoft },
  formatLabel: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 9.5 },
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
  previewTitle: { marginTop: 4, color: colors.ink, fontFamily: fonts.semibold, fontSize: 18 },
  wordBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.mossSoft },
  wordBadgeText: { color: colors.moss, fontFamily: fonts.semibold, fontSize: 9 },
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
  emptyPreviewTitle: { marginTop: 13, color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  emptyPreviewText: { marginTop: 6, color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,24,21,0.34)' },
  projectSheet: {
    maxHeight: '72%',
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.paper,
  },
  sheetHandle: { width: 38, height: 4, alignSelf: 'center', marginBottom: 18, borderRadius: 2, backgroundColor: colors.lineStrong },
  sheetEyebrow: { color: colors.moss, fontFamily: fonts.semibold, fontSize: 8, letterSpacing: 1.2 },
  sheetTitle: { marginTop: 4, marginBottom: 16, color: colors.ink, fontFamily: fonts.semibold, fontSize: 23 },
  projectChoice: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  projectChoicePressed: { backgroundColor: colors.mossSoft },
  choiceDot: { width: 12, height: 12, borderRadius: 6, marginRight: 11 },
  choiceName: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 14 },
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
  discardIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderRadius: 15,
    backgroundColor: '#F5E5E2',
  },
  discardTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 20,
    letterSpacing: -0.45,
  },
  discardBody: {
    marginTop: 6,
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
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
