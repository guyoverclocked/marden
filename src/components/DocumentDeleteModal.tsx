import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { colors, darkColors, fonts, radii, shadow } from '../theme';
import { MarkdownDocument } from '../types';

type DocumentDeleteModalProps = {
  document: MarkdownDocument | null;
  darkMode: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DocumentDeleteModal({ document, darkMode, onClose, onConfirm }: DocumentDeleteModalProps) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(document)} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, darkMode && styles.cardDark]}>
          <View style={[styles.icon, darkMode && styles.iconDark]}>
            <Trash2 size={21} color={colors.error} />
          </View>
          <Text style={styles.eyebrow}>REMOVE FROM MARDEN</Text>
          <Text style={[styles.title, darkMode && styles.titleDark]}>Delete this file?</Text>
          <Text numberOfLines={2} style={[styles.documentName, darkMode && styles.documentNameDark]}>{document?.title}</Text>
          <Text style={[styles.body, darkMode && styles.bodyDark]}>
            The copy kept inside Marden will be removed. You can undo it for a few seconds, and an original imported file stays unchanged.
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel delete"
              onPress={onClose}
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            >
              <Text style={[styles.cancelText, darkMode && styles.cancelTextDark]}>Keep file</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm delete"
              onPress={onConfirm}
              style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
            >
              <Trash2 size={16} color={colors.paper} />
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
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
    maxWidth: 370,
    padding: 23,
    borderRadius: radii.lg,
    backgroundColor: colors.paperStrong,
    ...shadow.floating,
  },
  cardDark: { backgroundColor: darkColors.paperStrong },
  icon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderRadius: 15,
    backgroundColor: '#F5E5E2',
  },
  iconDark: { backgroundColor: '#402725' },
  eyebrow: { color: colors.error, fontFamily: fonts.semibold, fontSize: 7.5, letterSpacing: 1.1 },
  title: { marginTop: 5, color: colors.ink, fontFamily: fonts.semibold, fontSize: 21, letterSpacing: -0.5 },
  titleDark: { color: darkColors.ink },
  documentName: { marginTop: 12, color: colors.ink, fontFamily: fonts.medium, fontSize: 13 },
  documentNameDark: { color: darkColors.ink },
  body: { marginTop: 6, color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 18 },
  bodyDark: { color: darkColors.inkSoft },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 23 },
  cancel: { height: 44, justifyContent: 'center', paddingHorizontal: 16 },
  cancelText: { color: colors.inkSoft, fontFamily: fonts.semibold, fontSize: 11 },
  cancelTextDark: { color: darkColors.inkSoft },
  delete: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.error,
  },
  deleteText: { color: colors.paper, fontFamily: fonts.semibold, fontSize: 11 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
});
