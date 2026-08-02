import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FilePenLine, FolderInput, Pencil, Star, Trash2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, darkColors, fonts, radii } from '../theme';
import { MarkdownDocument } from '../types';

type DocumentActionsModalProps = {
  document: MarkdownDocument | null;
  darkMode: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRename: () => void;
  onMove: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
};

export function DocumentActionsModal({
  document,
  darkMode,
  onClose,
  onEdit,
  onRename,
  onMove,
  onToggleFavorite,
  onDelete,
}: DocumentActionsModalProps) {
  const theme = darkMode ? darkColors : colors;
  return (
    <Modal animationType="slide" transparent visible={Boolean(document)} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, darkMode && styles.sheetDark]}>
          <View style={[styles.handle, darkMode && styles.handleDark]} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={[styles.title, darkMode && styles.titleDark]}>{document?.title}</Text>
              <Text numberOfLines={1} style={[styles.fileName, darkMode && styles.fileNameDark]}>{document?.fileName}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close document actions" onPress={onClose} style={[styles.closeButton, darkMode && styles.closeButtonDark]}>
              <X size={18} color={theme.ink} />
            </Pressable>
          </View>
          <Action
            darkMode={darkMode}
            icon={<FilePenLine size={19} color={theme.moss} />}
            title="Edit Markdown"
            description="Update the title, content, or project"
            onPress={onEdit}
          />
          <Action
            darkMode={darkMode}
            icon={<Pencil size={19} color={theme.moss} />}
            title="Rename file"
            description="Change how this document appears in your library"
            onPress={onRename}
          />
          <Action
            darkMode={darkMode}
            icon={<FolderInput size={19} color={theme.moss} />}
            title="Move to project"
            description="Organize this document or keep it Unfiled"
            onPress={onMove}
          />
          <Action
            darkMode={darkMode}
            icon={<Star size={19} color={theme.moss} fill={document?.isFavorite ? colors.lime : 'transparent'} />}
            title={document?.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            description="Keep important reading close at hand"
            onPress={onToggleFavorite}
          />
          <Action
            destructive
            darkMode={darkMode}
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
  darkMode,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  destructive?: boolean;
  darkMode: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.action, darkMode && styles.actionDark, pressed && styles.actionPressed, darkMode && pressed && styles.actionPressedDark]}
    >
      <View style={[styles.actionIcon, darkMode && styles.actionIconDark, destructive && styles.actionIconDestructive, darkMode && destructive && styles.actionIconDestructiveDark]}>{icon}</View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, darkMode && styles.actionTitleDark, destructive && styles.actionTitleDestructive]}>{title}</Text>
        <Text style={[styles.actionDescription, darkMode && styles.actionDescriptionDark]}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,24,21,0.36)' },
  sheet: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 8, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.paper },
  sheetDark: { backgroundColor: darkColors.paper },
  handle: { width: 38, height: 4, alignSelf: 'center', marginBottom: 18, borderRadius: 2, backgroundColor: colors.lineStrong },
  handleDark: { backgroundColor: darkColors.lineStrong },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 20, letterSpacing: -0.45 },
  titleDark: { color: darkColors.ink },
  fileName: { marginTop: 3, color: colors.inkFaint, fontFamily: fonts.regular, fontSize: 9.5 },
  fileNameDark: { color: darkColors.inkFaint },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.sand },
  closeButtonDark: { backgroundColor: darkColors.paperStrong },
  action: { minHeight: 75, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  actionDark: { borderTopColor: darkColors.line },
  actionPressed: { backgroundColor: colors.mossSoft },
  actionPressedDark: { backgroundColor: darkColors.mossSoft },
  actionIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.mossSoft },
  actionIconDark: { backgroundColor: darkColors.mossSoft },
  actionIconDestructive: { backgroundColor: '#F5E5E2' },
  actionIconDestructiveDark: { backgroundColor: '#402725' },
  actionCopy: { flex: 1, paddingLeft: 12 },
  actionTitle: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13.5 },
  actionTitleDark: { color: darkColors.ink },
  actionTitleDestructive: { color: colors.error },
  actionDescription: { marginTop: 3, color: colors.inkFaint, fontFamily: fonts.regular, fontSize: 9.5 },
  actionDescriptionDark: { color: darkColors.inkFaint },
});
