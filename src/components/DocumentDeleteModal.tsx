import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { colors, fonts, radii, shadow } from '../theme';
import { MarkdownDocument } from '../types';

type DocumentDeleteModalProps = {
  document: MarkdownDocument | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function DocumentDeleteModal({ document, onClose, onConfirm }: DocumentDeleteModalProps) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(document)} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.icon}>
            <Trash2 size={21} color={colors.error} />
          </View>
          <Text style={styles.eyebrow}>REMOVE FROM MARDEN</Text>
          <Text style={styles.title}>Delete this file?</Text>
          <Text numberOfLines={2} style={styles.documentName}>{document?.title}</Text>
          <Text style={styles.body}>
            The copy kept inside Marden will be removed. An original imported file stays unchanged.
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel delete"
              onPress={onClose}
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Keep file</Text>
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
  icon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderRadius: 15,
    backgroundColor: '#F5E5E2',
  },
  eyebrow: { color: colors.error, fontFamily: fonts.semibold, fontSize: 7.5, letterSpacing: 1.1 },
  title: { marginTop: 5, color: colors.ink, fontFamily: fonts.semibold, fontSize: 21, letterSpacing: -0.5 },
  documentName: { marginTop: 12, color: colors.ink, fontFamily: fonts.medium, fontSize: 13 },
  body: { marginTop: 6, color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 18 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 23 },
  cancel: { height: 44, justifyContent: 'center', paddingHorizontal: 16 },
  cancelText: { color: colors.inkSoft, fontFamily: fonts.semibold, fontSize: 11 },
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
