import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, FolderInput, Inbox, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, darkColors, fonts, radii } from '../theme';
import { Project } from '../types';

type ProjectAssignmentModalProps = {
  visible: boolean;
  darkMode: boolean;
  documentTitle?: string;
  currentProjectId: string | null;
  projects: Project[];
  onClose: () => void;
  onSelect: (projectId: string | null) => void;
};

export function ProjectAssignmentModal({
  visible,
  darkMode,
  documentTitle,
  currentProjectId,
  projects,
  onClose,
  onSelect,
}: ProjectAssignmentModalProps) {
  const theme = darkMode ? darkColors : colors;
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, darkMode && styles.sheetDark]}>
          <View style={[styles.handle, darkMode && styles.handleDark]} />
          <View style={styles.header}>
            <View style={styles.titleCopy}>
              <Text style={[styles.eyebrow, darkMode && styles.eyebrowDark]}>MOVE TO PROJECT</Text>
              <Text numberOfLines={1} style={[styles.title, darkMode && styles.titleDark]}>
                {documentTitle || 'Choose a project'}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close project picker" onPress={onClose} style={[styles.closeButton, darkMode && styles.closeButtonDark]}>
              <X size={19} color={theme.ink} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Choice
              name="Unfiled"
              description="Keep this document separate"
              color={colors.lineStrong}
              selected={!currentProjectId}
              darkMode={darkMode}
              unfiled
              onPress={() => onSelect(null)}
            />
            {projects.map((project) => (
              <Choice
                key={project.id}
                name={project.name}
                description="Project"
                color={project.color}
                selected={currentProjectId === project.id}
                darkMode={darkMode}
                onPress={() => onSelect(project.id)}
              />
            ))}
            {projects.length === 0 ? (
              <View style={styles.emptyNote}>
                <FolderInput size={20} color={colors.moss} />
                <Text style={styles.emptyText}>Create a project from the library first, or leave this file Unfiled.</Text>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Choice({
  name,
  description,
  color,
  selected,
  darkMode,
  unfiled = false,
  onPress,
}: {
  name: string;
  description: string;
  color: string;
  selected: boolean;
  darkMode: boolean;
  unfiled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Move to ${name}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, darkMode && styles.choiceDark, pressed && styles.choicePressed, darkMode && pressed && styles.choicePressedDark]}
    >
      <View style={[styles.choiceIcon, darkMode && styles.choiceIconDark, !darkMode && { backgroundColor: unfiled ? colors.sand : `${color}1F` }]}>
        {unfiled ? <Inbox size={18} color={darkMode ? darkColors.inkSoft : colors.inkSoft} /> : <View style={[styles.projectDot, { backgroundColor: color }]} />}
      </View>
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceName, darkMode && styles.choiceNameDark]}>{name}</Text>
        <Text style={[styles.choiceDescription, darkMode && styles.choiceDescriptionDark]}>{description}</Text>
      </View>
      {selected ? (
        <View style={styles.selectedMark}>
          <Check size={15} color={colors.paper} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,24,21,0.36)' },
  sheet: {
    maxHeight: '72%',
    minHeight: 330,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.paper,
  },
  sheetDark: { backgroundColor: darkColors.paper },
  handle: { width: 38, height: 4, alignSelf: 'center', marginBottom: 18, borderRadius: 2, backgroundColor: colors.lineStrong },
  handleDark: { backgroundColor: darkColors.lineStrong },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  titleCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.moss, fontFamily: fonts.semibold, fontSize: 8, letterSpacing: 1.2 },
  eyebrowDark: { color: darkColors.moss },
  title: { marginTop: 4, color: colors.ink, fontFamily: fonts.semibold, fontSize: 21, letterSpacing: -0.5 },
  titleDark: { color: darkColors.ink },
  closeButton: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.sand },
  closeButtonDark: { backgroundColor: darkColors.paperStrong },
  choice: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  choicePressed: { backgroundColor: colors.mossSoft },
  choiceDark: { borderBottomColor: darkColors.line },
  choicePressedDark: { backgroundColor: darkColors.mossSoft },
  choiceIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  choiceIconDark: { backgroundColor: darkColors.mossSoft },
  projectDot: { width: 17, height: 17, borderRadius: 6 },
  choiceCopy: { flex: 1, paddingHorizontal: 12 },
  choiceName: { color: colors.ink, fontFamily: fonts.medium, fontSize: 14 },
  choiceNameDark: { color: darkColors.ink },
  choiceDescription: { marginTop: 2, color: colors.inkFaint, fontFamily: fonts.regular, fontSize: 9.5 },
  choiceDescriptionDark: { color: darkColors.inkFaint },
  selectedMark: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.moss },
  emptyNote: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 17, padding: 14, borderRadius: radii.sm, backgroundColor: colors.mossSoft },
  emptyText: { flex: 1, color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 15 },
});
