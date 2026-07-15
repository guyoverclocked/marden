import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, FileText, X } from 'lucide-react-native';

import { colors, fonts, radii, shadow } from '../theme';
import { MarkdownDocument } from '../types';
import { stripExtension } from '../utils/markdown';

type DocumentRenameModalProps = {
  document: MarkdownDocument | null;
  onClose: () => void;
  onSave: (name: string) => void;
};

export function DocumentRenameModal({ document, onClose, onSave }: DocumentRenameModalProps) {
  const inputRef = useRef<TextInput>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!document) return;
    setName(stripExtension(document.fileName) || document.title);
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [document]);

  const submit = () => {
    if (!name.trim()) return;
    onSave(name);
  };

  return (
    <Modal animationType="fade" transparent visible={Boolean(document)} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.icon}>
              <FileText size={20} color={colors.moss} />
            </View>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>FILE DETAILS</Text>
              <Text style={styles.title}>Rename Markdown</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close rename" onPress={onClose} style={styles.close}>
              <X size={18} color={colors.ink} />
            </Pressable>
          </View>
          <Text style={styles.label}>FILE NAME</Text>
          <View style={styles.inputShell}>
            <TextInput
              ref={inputRef}
              accessibilityLabel="Markdown file name"
              autoCapitalize="sentences"
              autoCorrect={false}
              enterKeyHint="done"
              maxLength={120}
              onChangeText={setName}
              onSubmitEditing={submit}
              placeholder="Document name"
              placeholderTextColor={colors.inkFaint}
              returnKeyType="done"
              selectionColor={colors.moss}
              selectTextOnFocus
              style={styles.input}
              value={name}
            />
            <Text style={styles.extension}>.md</Text>
          </View>
          <Text style={styles.help}>The document stays in the same project. Its contents are unchanged.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save new file name"
            disabled={!name.trim()}
            onPress={submit}
            style={({ pressed }) => [
              styles.save,
              !name.trim() && styles.saveDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Check size={17} color={colors.paper} />
            <Text style={styles.saveText}>Save name</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(20,24,21,0.48)',
  },
  card: {
    width: '100%',
    maxWidth: 390,
    padding: 22,
    borderRadius: radii.lg,
    backgroundColor: colors.paperStrong,
    ...shadow.floating,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 23 },
  icon: {
    width: 43,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.mossSoft,
  },
  headingCopy: { flex: 1, paddingLeft: 12 },
  eyebrow: { color: colors.moss, fontFamily: fonts.semibold, fontSize: 7.5, letterSpacing: 1.1 },
  title: { marginTop: 3, color: colors.ink, fontFamily: fonts.semibold, fontSize: 19, letterSpacing: -0.4 },
  close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.sand },
  label: { marginBottom: 7, color: colors.inkSoft, fontFamily: fonts.semibold, fontSize: 8, letterSpacing: 1 },
  inputShell: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.moss,
    borderRadius: radii.sm,
    backgroundColor: colors.paper,
  },
  input: { flex: 1, height: '100%', paddingLeft: 14, color: colors.ink, fontFamily: fonts.medium, fontSize: 14 },
  extension: { paddingHorizontal: 14, color: colors.inkFaint, fontFamily: fonts.mono, fontSize: 12 },
  help: { marginTop: 9, color: colors.inkFaint, fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 15 },
  save: {
    height: 47,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.moss,
  },
  saveDisabled: { opacity: 0.45 },
  saveText: { color: colors.paper, fontFamily: fonts.semibold, fontSize: 12 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
});
