import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, FolderInput, Inbox, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii } from '../theme';
import { Project } from '../types';

type ProjectAssignmentModalProps = {
  visible: boolean;
  documentTitle?: string;
  currentProjectId: string | null;
  projects: Project[];
  onClose: () => void;
  onSelect: (projectId: string | null) => void;
};

export function ProjectAssignmentModal({
  visible,
  documentTitle,
  currentProjectId,
  projects,
  onClose,
  onSelect,
}: ProjectAssignmentModalProps) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleCopy}>
              <Text style={styles.eyebrow}>MOVE TO PROJECT</Text>
              <Text numberOfLines={1} style={styles.title}>
                {documentTitle || 'Choose a project'}
              </Text>
            </View>
            <Pressable accessibilityLabel="Close project picker" onPress={onClose} style={styles.closeButton}>
              <X size={19} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Choice
              name="Unfiled"
              description="Keep this document separate"
              color={colors.lineStrong}
              selected={!currentProjectId}
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
  unfiled = false,
  onPress,
}: {
  name: string;
  description: string;
  color: string;
  selected: boolean;
  unfiled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}>
      <View style={[styles.choiceIcon, { backgroundColor: unfiled ? colors.sand : `${color}1F` }]}>
        {unfiled ? <Inbox size={18} color={colors.inkSoft} /> : <View style={[styles.projectDot, { backgroundColor: color }]} />}
      </View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceName}>{name}</Text>
        <Text style={styles.choiceDescription}>{description}</Text>
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
  handle: { width: 38, height: 4, alignSelf: 'center', marginBottom: 18, borderRadius: 2, backgroundColor: colors.lineStrong },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  titleCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.moss, fontFamily: fonts.semibold, fontSize: 8, letterSpacing: 1.2 },
  title: { marginTop: 4, color: colors.ink, fontFamily: fonts.semibold, fontSize: 21, letterSpacing: -0.5 },
  closeButton: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.sand },
  choice: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  choicePressed: { backgroundColor: colors.mossSoft },
  choiceIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  projectDot: { width: 17, height: 17, borderRadius: 6 },
  choiceCopy: { flex: 1, paddingHorizontal: 12 },
  choiceName: { color: colors.ink, fontFamily: fonts.medium, fontSize: 14 },
  choiceDescription: { marginTop: 2, color: colors.inkFaint, fontFamily: fonts.regular, fontSize: 9.5 },
  selectedMark: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.moss },
  emptyNote: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 17, padding: 14, borderRadius: radii.sm, backgroundColor: colors.mossSoft },
  emptyText: { flex: 1, color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 15 },
});
