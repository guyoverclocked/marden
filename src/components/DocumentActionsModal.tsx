import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FolderInput, Star, Trash2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii } from '../theme';
import { MarkdownDocument } from '../types';

type DocumentActionsModalProps = {
  document: MarkdownDocument | null;
  onClose: () => void;
  onMove: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
};

export function DocumentActionsModal({
  document,
  onClose,
  onMove,
  onToggleFavorite,
  onDelete,
}: DocumentActionsModalProps) {
  return (
    <Modal animationType="slide" transparent visible={Boolean(document)} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={styles.title}>{document?.title}</Text>
              <Text numberOfLines={1} style={styles.fileName}>{document?.fileName}</Text>
            </View>
            <Pressable accessibilityLabel="Close document actions" onPress={onClose} style={styles.closeButton}>
              <X size={18} color={colors.ink} />
            </Pressable>
          </View>
          <Action
            icon={<FolderInput size={19} color={colors.moss} />}
            title="Move to project"
            description="Organize this document or keep it Unfiled"
            onPress={onMove}
          />
          <Action
            icon={<Star size={19} color={colors.moss} fill={document?.isFavorite ? colors.lime : 'transparent'} />}
            title={document?.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            description="Keep important reading close at hand"
            onPress={onToggleFavorite}
          />
          <Action
            destructive
            icon={<Trash2 size={19} color={colors.error} />}
            title="Delete from Marden"
            description="The original imported file will stay untouched"
            onPress={onDelete}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Action({
  icon,
  title,
  description,
  destructive = false,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <View style={[styles.actionIcon, destructive && styles.actionIconDestructive]}>{icon}</View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, destructive && styles.actionTitleDestructive]}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,24,21,0.36)' },
  sheet: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 8, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.paper },
  handle: { width: 38, height: 4, alignSelf: 'center', marginBottom: 18, borderRadius: 2, backgroundColor: colors.lineStrong },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 20, letterSpacing: -0.45 },
  fileName: { marginTop: 3, color: colors.inkFaint, fontFamily: fonts.regular, fontSize: 9.5 },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.sand },
  action: { minHeight: 75, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  actionPressed: { backgroundColor: colors.mossSoft },
  actionIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.mossSoft },
  actionIconDestructive: { backgroundColor: '#F5E5E2' },
  actionCopy: { flex: 1, paddingLeft: 12 },
  actionTitle: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13.5 },
  actionTitleDestructive: { color: colors.error },
  actionDescription: { marginTop: 3, color: colors.inkFaint, fontFamily: fonts.regular, fontSize: 9.5 },
});
