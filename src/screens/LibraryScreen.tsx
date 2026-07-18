import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Check,
  FilePlus2,
  FileUp,
  FolderOpen,
  FolderPlus,
  PencilLine,
  Plus,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '../components/BrandMark';
import { DocumentCard } from '../components/DocumentCard';
import { colors, darkColors, fonts, radii, shadow } from '../theme';
import { LibraryFilter, MarkdownDocument, Project, ProjectFilter } from '../types';

const PROJECT_COLORS = ['#315C4A', '#6A4950', '#4B596C', '#9A6B3F', '#66548A', '#3F7180'];

type LibraryScreenProps = {
  documents: MarkdownDocument[];
  projects: Project[];
  darkMode: boolean;
  isLoading: boolean;
  isImporting: boolean;
  onImport: () => void;
  onCreateDocument: () => void;
  onCreateProject: (name: string, color: string) => Project;
  onOpen: (document: MarkdownDocument) => void;
  onDocumentMenu: (document: MarkdownDocument) => void;
};

export function LibraryScreen({
  documents,
  projects,
  darkMode,
  isLoading,
  isImporting,
  onImport,
  onCreateDocument,
  onCreateProject,
  onOpen,
  onDocumentMenu,
}: LibraryScreenProps) {
  const { width: windowWidth } = useWindowDimensions();
  const desktop = windowWidth >= 900;
  const theme = darkMode ? darkColors : colors;
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);

  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...documents]
      .filter((document) => (filter === 'favorites' ? document.isFavorite : true))
      .filter((document) => {
        if (projectFilter === 'all') return true;
        if (projectFilter === 'unfiled') return !document.projectId;
        return document.projectId === projectFilter;
      })
      .filter((document) => {
        if (!normalized) return true;
        const projectName = projects.find((project) => project.id === document.projectId)?.name || '';
        return (
          document.title.toLowerCase().includes(normalized) ||
          document.fileName.toLowerCase().includes(normalized) ||
          projectName.toLowerCase().includes(normalized) ||
          document.content.toLowerCase().includes(normalized)
        );
      })
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  }, [documents, filter, projectFilter, projects, query]);

  const closeSearch = () => {
    setQuery('');
    setSearchOpen(false);
  };

  const createProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const project = onCreateProject(name, newProjectColor);
    setProjectFilter(project.id);
    setNewProjectName('');
    setProjectModalOpen(false);
  };

  const activeProjectName =
    projectFilter === 'all'
      ? 'Recent reading'
      : projectFilter === 'unfiled'
        ? 'Unfiled'
        : projects.find((project) => project.id === projectFilter)?.name || 'Project';

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, darkMode && styles.safeAreaDark]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, desktop && styles.scrollContentDesktop]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <BrandMark />
            <View style={styles.brandCopy}>
              <Text style={[styles.brandName, darkMode && styles.textStrongDark]}>Marden</Text>
              <Text style={[styles.brandTagline, darkMode && styles.textSoftDark]}>Your Markdown, beautifully kept.</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search library"
            onPress={() => setSearchOpen(true)}
            style={({ pressed }) => [styles.headerButton, darkMode && styles.surfaceDark, pressed && styles.pressed]}
          >
            <Search size={21} color={theme.ink} />
          </Pressable>
        </View>

        {searchOpen ? (
          <View style={[styles.searchBox, darkMode && styles.surfaceDark]}>
            <Search size={18} color={theme.inkFaint} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search files, projects and text"
              placeholderTextColor={theme.inkFaint}
              selectionColor={theme.moss}
              style={[styles.searchInput, darkMode && styles.textStrongDark]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close search"
              hitSlop={10}
              onPress={closeSearch}
            >
              <X size={18} color={theme.inkSoft} />
            </Pressable>
          </View>
        ) : (
          <LinearGradient
            colors={[colors.moss, colors.mossDark]}
            style={[styles.importCard, desktop && styles.importCardDesktop]}
          >
            <View style={styles.sparkleBadge}>
              <Sparkles size={14} color={colors.lime} />
              <Text style={styles.sparkleText}>YOUR READING SPACE</Text>
            </View>
            <Text style={styles.importTitle}>Make room for{`\n`}your thinking.</Text>
            <Text style={styles.importBody}>
              Bring in a Markdown file and make it feel at home.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import Markdown file"
              disabled={isImporting}
              onPress={onImport}
              style={({ pressed }) => [styles.importButton, pressed && styles.importButtonPressed]}
            >
              {isImporting ? (
                <ActivityIndicator size="small" color={colors.mossDark} />
              ) : (
                <FilePlus2 size={18} color={colors.mossDark} />
              )}
              <Text style={styles.importButtonText}>{isImporting ? 'Importing…' : 'Import Markdown'}</Text>
            </Pressable>
            <View style={styles.decorativePage}>
              <Text style={styles.decorativePageMark}>M↓</Text>
              <View style={styles.decorativeLine} />
              <View style={[styles.decorativeLine, { width: '56%' }]} />
              <View style={[styles.decorativeLine, { width: '72%' }]} />
            </View>
          </LinearGradient>
        )}

        <View style={styles.projectsHeader}>
          <View>
            <Text style={[styles.eyebrow, darkMode && styles.accentTextDark]}>PROJECTS</Text>
            <Text style={[styles.projectsTitle, darkMode && styles.textStrongDark]}>Keep work together</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a new project"
            onPress={() => setProjectModalOpen(true)}
            style={({ pressed }) => [styles.newProjectButton, darkMode && styles.accentSurfaceDark, pressed && styles.pressed]}
          >
            <FolderPlus size={15} color={theme.moss} />
            <Text style={[styles.newProjectText, darkMode && styles.accentTextDark]}>New</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.projectChips, desktop && styles.projectChipsDesktop]}
          style={[styles.projectScroll, desktop && styles.projectScrollDesktop]}
        >
          <ProjectChip
            label="All files"
            count={documents.length}
            color={colors.moss}
            selected={projectFilter === 'all'}
            darkMode={darkMode}
            onPress={() => setProjectFilter('all')}
          />
          <ProjectChip
            label="Unfiled"
            count={documents.filter((document) => !document.projectId).length}
            color={colors.lineStrong}
            selected={projectFilter === 'unfiled'}
            darkMode={darkMode}
            onPress={() => setProjectFilter('unfiled')}
          />
          {projects.map((project) => (
            <ProjectChip
              key={project.id}
              label={project.name}
              count={documents.filter((document) => document.projectId === project.id).length}
              color={project.color}
              selected={projectFilter === project.id}
              darkMode={darkMode}
              onPress={() => setProjectFilter(project.id)}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add project"
            onPress={() => setProjectModalOpen(true)}
            style={({ pressed }) => [styles.addProjectChip, darkMode && styles.surfaceDark, pressed && styles.pressed]}
          >
            <Plus size={17} color={theme.moss} />
          </Pressable>
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.eyebrow, darkMode && styles.accentTextDark]}>
              {query ? `${visibleDocuments.length} ${visibleDocuments.length === 1 ? 'MATCH' : 'MATCHES'}` : 'YOUR LIBRARY'}
            </Text>
            <Text style={[styles.sectionTitle, darkMode && styles.textStrongDark]}>
              {query ? 'Search results' : activeProjectName}
            </Text>
          </View>
          <View style={styles.filters}>
            <Pressable
              onPress={() => setFilter('all')}
              style={[
                styles.filterButton,
                darkMode && styles.surfaceDark,
                filter === 'all' && styles.filterButtonActive,
                darkMode && filter === 'all' && styles.filterButtonActiveDark,
              ]}
            >
              <FolderOpen size={14} color={filter === 'all' ? colors.paper : theme.inkSoft} />
              <Text
                style={[
                  styles.filterText,
                  darkMode && styles.textSoftDark,
                  filter === 'all' && styles.filterTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Show favorites"
              onPress={() => setFilter('favorites')}
              style={[
                styles.starFilter,
                darkMode && styles.surfaceDark,
                filter === 'favorites' && styles.starFilterActive,
                darkMode && filter === 'favorites' && styles.starFilterActiveDark,
              ]}
            >
              <Star
                size={16}
                color={filter === 'favorites' ? colors.mossDark : theme.inkSoft}
                fill={filter === 'favorites' ? colors.lime : 'transparent'}
              />
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View style={[styles.stateCard, darkMode && styles.surfaceDark]}>
            <ActivityIndicator color={theme.moss} />
            <Text style={[styles.stateText, darkMode && styles.textSoftDark]}>Opening your library…</Text>
          </View>
        ) : visibleDocuments.length > 0 ? (
          <View style={[styles.documentList, desktop && styles.documentListDesktop]}>
            {visibleDocuments.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                projectName={projects.find((project) => project.id === document.projectId)?.name}
                darkMode={darkMode}
                desktop={desktop}
                onPress={() => onOpen(document)}
                onMenu={() => onDocumentMenu(document)}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.stateCard, darkMode && styles.surfaceDark]}>
            <View style={[styles.emptyIcon, darkMode && styles.accentSurfaceDark]}>
              <FolderOpen size={24} color={theme.moss} />
            </View>
            <Text style={[styles.emptyTitle, darkMode && styles.textStrongDark]}>
              {query ? 'Nothing found' : 'No saved files yet'}
            </Text>
            <Text style={[styles.stateText, darkMode && styles.textSoftDark]}>
              {query ? 'Try another title or phrase.' : 'Import a Markdown file to begin your library.'}
            </Text>
          </View>
        )}

        <Text style={[styles.localNote, darkMode && styles.textFaintDark]}>Made with ❤️ by Nambi</Text>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add Markdown"
        disabled={isImporting}
        onPress={() => setAddSheetOpen(true)}
        style={({ pressed }) => [
          styles.floatingButton,
          darkMode && styles.floatingButtonDark,
          desktop && { right: Math.max(36, (windowWidth - 1180) / 2 + 36) },
          pressed && styles.floatingButtonPressed,
        ]}
      >
        {isImporting ? (
          <ActivityIndicator size="small" color={colors.mossDark} />
        ) : (
          <Plus size={25} color={colors.mossDark} />
        )}
      </Pressable>

      <Modal animationType="slide" transparent visible={addSheetOpen} onRequestClose={() => setAddSheetOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddSheetOpen(false)} />
          <SafeAreaView
            edges={['bottom']}
            style={[styles.addSheet, darkMode && styles.addSheetDark, desktop && styles.addSheetDesktop]}
          >
            <View style={[styles.sheetHandle, darkMode && styles.sheetHandleDark]} />
            <Text style={[styles.sheetEyebrow, darkMode && styles.accentTextDark]}>ADD TO MARDEN</Text>
            <Text style={[styles.sheetTitle, darkMode && styles.textStrongDark]}>How would you like to begin?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import a Markdown file"
              onPress={() => {
                setAddSheetOpen(false);
                onImport();
              }}
              style={({ pressed }) => [
                styles.addOption,
                darkMode && styles.surfaceDark,
                pressed && styles.addOptionPressed,
                darkMode && pressed && styles.addOptionPressedDark,
              ]}
            >
              <View style={[styles.addOptionIcon, styles.importOptionIcon, darkMode && styles.accentSurfaceDark]}>
                <FileUp size={22} color={theme.moss} />
              </View>
              <View style={styles.addOptionCopy}>
                <Text style={[styles.addOptionTitle, darkMode && styles.textStrongDark]}>Import a file</Text>
                <Text style={[styles.addOptionBody, darkMode && styles.textSoftDark]}>
                  Choose .md or .markdown from Files, Drive, or another app.
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Write or paste Markdown"
              onPress={() => {
                setAddSheetOpen(false);
                onCreateDocument();
              }}
              style={({ pressed }) => [
                styles.addOption,
                darkMode && styles.surfaceDark,
                pressed && styles.addOptionPressed,
                darkMode && pressed && styles.addOptionPressedDark,
              ]}
            >
              <View style={[styles.addOptionIcon, styles.editorOptionIcon]}>
                <PencilLine size={22} color="#65507B" />
              </View>
              <View style={styles.addOptionCopy}>
                <View style={styles.addOptionTitleRow}>
                  <Text style={[styles.addOptionTitle, darkMode && styles.textStrongDark]}>Write or paste</Text>
                  <View style={[styles.aiBadge, darkMode && styles.accentSurfaceDark]}>
                    <Sparkles size={10} color={theme.moss} />
                    <Text style={[styles.aiBadgeText, darkMode && styles.accentTextDark]}>AI FRIENDLY</Text>
                  </View>
                </View>
                <Text style={[styles.addOptionBody, darkMode && styles.textSoftDark]}>
                  Start a note or paste Markdown from your favourite AI app.
                </Text>
              </View>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={projectModalOpen}
        onRequestClose={() => setProjectModalOpen(false)}
      >
        <View style={styles.centeredModalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setProjectModalOpen(false)} />
          <View style={[styles.projectModalCard, darkMode && styles.projectModalCardDark]}>
            <View style={[styles.projectModalIcon, darkMode && styles.accentSurfaceDark]}>
              <FolderPlus size={22} color={theme.moss} />
            </View>
            <Text style={[styles.projectModalTitle, darkMode && styles.textStrongDark]}>Create a project</Text>
            <Text style={[styles.projectModalBody, darkMode && styles.textSoftDark]}>
              Group related Markdown while everything else stays Unfiled.
            </Text>
            <TextInput
              autoFocus
              value={newProjectName}
              onChangeText={setNewProjectName}
              onSubmitEditing={createProject}
              placeholder="Project name"
              placeholderTextColor={theme.inkFaint}
              returnKeyType="done"
              selectionColor={theme.moss}
              style={[styles.projectNameInput, darkMode && styles.projectNameInputDark]}
            />
            <Text style={[styles.colorLabel, darkMode && styles.textFaintDark]}>COLOR</Text>
            <View style={styles.colorOptions}>
              {PROJECT_COLORS.map((color) => (
                <Pressable
                  key={color}
                  accessibilityLabel={`Use project color ${color}`}
                  onPress={() => setNewProjectColor(color)}
                  style={[styles.colorOption, { backgroundColor: color }, newProjectColor === color && styles.colorOptionSelected]}
                >
                  {newProjectColor === color ? <Check size={15} color={colors.paper} /> : null}
                </Pressable>
              ))}
            </View>
            <View style={styles.projectModalActions}>
              <Pressable onPress={() => setProjectModalOpen(false)} style={styles.cancelProjectButton}>
                <Text style={[styles.cancelProjectText, darkMode && styles.textSoftDark]}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!newProjectName.trim()}
                onPress={createProject}
                style={[styles.createProjectButton, !newProjectName.trim() && styles.createProjectButtonDisabled]}
              >
                <Text style={styles.createProjectText}>Create project</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ProjectChip({
  label,
  count,
  color,
  selected,
  darkMode,
  onPress,
}: {
  label: string;
  count: number;
  color: string;
  selected: boolean;
  darkMode: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.projectChip,
        darkMode && styles.surfaceDark,
        selected && styles.projectChipSelected,
        darkMode && selected && styles.projectChipSelectedDark,
      ]}
    >
      <View style={[styles.projectChipDot, { backgroundColor: color }]} />
      <Text
        numberOfLines={1}
        style={[
          styles.projectChipLabel,
          darkMode && styles.textSoftDark,
          selected && styles.projectChipLabelSelected,
          darkMode && selected && styles.textStrongDark,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.projectChipCount,
          darkMode && styles.textFaintDark,
          selected && styles.projectChipCountSelected,
          darkMode && selected && styles.accentTextDark,
        ]}
      >
        {count}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 118,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 9,
    paddingBottom: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandCopy: {
    marginLeft: 11,
  },
  brandName: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: -0.65,
  },
  brandTagline: {
    marginTop: 1,
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 10.5,
  },
  headerButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  searchBox: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    marginBottom: 29,
    borderRadius: radii.md,
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginHorizontal: 11,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  importCard: {
    minHeight: 258,
    padding: 24,
    marginBottom: 30,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadow.card,
  },
  sparkleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sparkleText: {
    color: colors.lime,
    fontFamily: fonts.semibold,
    fontSize: 9,
    letterSpacing: 1.3,
  },
  importTitle: {
    marginTop: 18,
    color: colors.paper,
    fontFamily: fonts.semibold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -1.05,
  },
  importBody: {
    width: '62%',
    marginTop: 8,
    color: 'rgba(251,250,247,0.67)',
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  importButton: {
    alignSelf: 'flex-start',
    minWidth: 162,
    height: 47,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 17,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
  },
  importButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  importButtonText: {
    color: colors.mossDark,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  decorativePage: {
    position: 'absolute',
    right: -18,
    bottom: -20,
    width: 145,
    height: 178,
    padding: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.075)',
    transform: [{ rotate: '-5deg' }],
  },
  decorativePageMark: {
    marginBottom: 25,
    color: 'rgba(255,255,255,0.22)',
    fontFamily: fonts.bold,
    fontSize: 34,
    letterSpacing: -2,
  },
  decorativeLine: {
    width: '86%',
    height: 3,
    marginBottom: 11,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 17,
  },
  eyebrow: {
    marginBottom: 4,
    color: colors.moss,
    fontFamily: fonts.semibold,
    fontSize: 9,
    letterSpacing: 1.45,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 22,
    letterSpacing: -0.7,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  filterButton: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterButtonActive: {
    borderColor: colors.moss,
    backgroundColor: colors.moss,
  },
  filterText: {
    color: colors.inkSoft,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  filterTextActive: {
    color: colors.paper,
  },
  starFilter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  starFilterActive: {
    borderColor: colors.lime,
    backgroundColor: '#EDF3D9',
  },
  documentList: {
    gap: 14,
  },
  stateCard: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
    borderRadius: radii.lg,
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    marginBottom: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mossSoft,
  },
  emptyTitle: {
    marginBottom: 6,
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  stateText: {
    marginTop: 9,
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  localNote: {
    marginTop: 28,
    color: colors.inkFaint,
    fontFamily: fonts.medium,
    fontSize: 10.5,
    textAlign: 'center',
  },
  floatingButton: {
    position: 'absolute',
    right: 22,
    bottom: 27,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
    borderWidth: 4,
    borderColor: colors.canvas,
    ...shadow.floating,
  },
  floatingButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.94 }],
  },
  projectsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  projectsTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 17,
    letterSpacing: -0.35,
  },
  newProjectButton: {
    height: 33,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    backgroundColor: colors.mossSoft,
  },
  newProjectText: {
    color: colors.moss,
    fontFamily: fonts.semibold,
    fontSize: 10.5,
  },
  projectScroll: {
    marginHorizontal: -20,
    marginBottom: 29,
  },
  projectChips: {
    gap: 8,
    paddingHorizontal: 20,
  },
  projectChip: {
    maxWidth: 175,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.paperStrong,
  },
  projectChipSelected: {
    borderColor: colors.moss,
    backgroundColor: '#EDF2ED',
  },
  projectChipDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  projectChipLabel: {
    flexShrink: 1,
    color: colors.inkSoft,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  projectChipLabelSelected: {
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  projectChipCount: {
    color: colors.inkFaint,
    fontFamily: fonts.semibold,
    fontSize: 9,
  },
  projectChipCountSelected: {
    color: colors.moss,
  },
  addProjectChip: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.paperStrong,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20,24,21,0.36)',
  },
  addSheet: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.paper,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
  },
  sheetEyebrow: {
    color: colors.moss,
    fontFamily: fonts.semibold,
    fontSize: 8.5,
    letterSpacing: 1.3,
  },
  sheetTitle: {
    marginTop: 4,
    marginBottom: 18,
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 24,
    letterSpacing: -0.7,
  },
  addOption: {
    minHeight: 102,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.paperStrong,
  },
  addOptionPressed: {
    borderColor: colors.moss,
    backgroundColor: '#F0F4EF',
    transform: [{ scale: 0.99 }],
  },
  addOptionIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  importOptionIcon: {
    backgroundColor: colors.mossSoft,
  },
  editorOptionIcon: {
    backgroundColor: '#ECE6F2',
  },
  addOptionCopy: {
    flex: 1,
    paddingLeft: 13,
  },
  addOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addOptionTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  addOptionBody: {
    marginTop: 5,
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.mossSoft,
  },
  aiBadgeText: {
    color: colors.moss,
    fontFamily: fonts.semibold,
    fontSize: 6.5,
    letterSpacing: 0.7,
  },
  centeredModalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(20,24,21,0.42)',
  },
  projectModalCard: {
    width: '100%',
    maxWidth: 390,
    padding: 22,
    borderRadius: radii.lg,
    backgroundColor: colors.paperStrong,
    ...shadow.floating,
  },
  projectModalIcon: {
    width: 47,
    height: 47,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderRadius: 15,
    backgroundColor: colors.mossSoft,
  },
  projectModalTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 21,
    letterSpacing: -0.5,
  },
  projectModalBody: {
    marginTop: 6,
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  projectNameInput: {
    height: 49,
    marginTop: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.sm,
    color: colors.ink,
    backgroundColor: colors.paper,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  colorLabel: {
    marginTop: 16,
    marginBottom: 9,
    color: colors.inkFaint,
    fontFamily: fonts.semibold,
    fontSize: 8,
    letterSpacing: 1.1,
  },
  colorOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  colorOption: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: colors.paperStrong,
    outlineWidth: 2,
    outlineColor: colors.ink,
  },
  projectModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
    marginTop: 22,
  },
  cancelProjectButton: {
    height: 43,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  cancelProjectText: {
    color: colors.inkSoft,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  createProjectButton: {
    height: 43,
    justifyContent: 'center',
    paddingHorizontal: 17,
    borderRadius: radii.pill,
    backgroundColor: colors.moss,
  },
  createProjectButtonDisabled: {
    opacity: 0.38,
  },
  createProjectText: {
    color: colors.paper,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  safeAreaDark: {
    backgroundColor: darkColors.canvas,
  },
  scrollContentDesktop: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 36,
  },
  importCardDesktop: {
    minHeight: 230,
  },
  projectScrollDesktop: {
    marginHorizontal: -36,
  },
  projectChipsDesktop: {
    paddingHorizontal: 36,
  },
  documentListDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  addSheetDesktop: {
    width: 560,
    alignSelf: 'center',
  },
  surfaceDark: {
    backgroundColor: darkColors.paperStrong,
    borderColor: darkColors.line,
  },
  accentSurfaceDark: {
    backgroundColor: darkColors.mossSoft,
  },
  textStrongDark: {
    color: darkColors.ink,
  },
  textSoftDark: {
    color: darkColors.inkSoft,
  },
  textFaintDark: {
    color: darkColors.inkFaint,
  },
  accentTextDark: {
    color: darkColors.moss,
  },
  filterButtonActiveDark: {
    borderColor: colors.moss,
    backgroundColor: colors.moss,
  },
  starFilterActiveDark: {
    borderColor: '#506449',
    backgroundColor: '#35412F',
  },
  projectChipSelectedDark: {
    borderColor: '#688373',
    backgroundColor: darkColors.mossSoft,
  },
  floatingButtonDark: {
    borderColor: darkColors.canvas,
  },
  addSheetDark: {
    backgroundColor: darkColors.paper,
  },
  sheetHandleDark: {
    backgroundColor: darkColors.lineStrong,
  },
  addOptionPressedDark: {
    borderColor: '#688373',
    backgroundColor: darkColors.mossSoft,
  },
  projectModalCardDark: {
    backgroundColor: darkColors.paperStrong,
  },
  projectNameInputDark: {
    color: darkColors.ink,
    borderColor: darkColors.lineStrong,
    backgroundColor: darkColors.paper,
  },
});
