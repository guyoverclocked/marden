import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Download, ExternalLink, X } from 'lucide-react-native';
import { colors, darkColors, fonts, radii, shadow } from '../theme';
import type { UpdateInfo } from '../utils/updateChecker';
import { downloadAndInstallApk, openDownloadUrl } from '../utils/updateChecker';

type UpdateModalProps = {
  updateInfo: UpdateInfo;
  darkMode: boolean;
  onDismiss: () => void;
};

export function UpdateModal({ updateInfo, darkMode, onDismiss }: UpdateModalProps) {
  const { width: windowWidth } = useWindowDimensions();
  const desktop = windowWidth >= 600;
  const theme = darkMode ? darkColors : colors;
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (Platform.OS === 'android' && updateInfo.apkUrl) {
      setDownloading(true);
      try { await downloadAndInstallApk(updateInfo.apkUrl); } catch {}
      setDownloading(false);
      onDismiss();
    } else if (Platform.OS === 'ios') {
      // iOS does not permit GitHub-sideloaded OTA installation. The release
      // page tells development users which TestFlight/App Store build to use.
      openDownloadUrl(updateInfo.iosAppStoreUrl || updateInfo.releaseUrl);
    } else {
      // Desktop / web — GitHub remains the manual fallback if auto-update is
      // unavailable (for example, an unsigned test desktop build).
      openDownloadUrl(updateInfo.releaseUrl);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.card, desktop && styles.cardDesktop, darkMode && styles.cardDark]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, darkMode && styles.textDark]}>
              Marden {updateInfo.version} is available
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              onPress={onDismiss}
              hitSlop={10}
              style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
            >
              <X size={17} color={theme.inkFaint} />
            </Pressable>
          </View>
          {updateInfo.releaseNotes.trim() ? (
            <ScrollView style={styles.notes} showsVerticalScrollIndicator={false}>
              <Text style={[styles.notesText, darkMode && styles.notesTextDark]}>
                {updateInfo.releaseNotes.slice(0, 5000)}
              </Text>
            </ScrollView>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                Platform.OS === 'ios' ? 'View update instructions' : 'Download update'
              }
              disabled={downloading}
              onPress={handleDownload}
              style={({ pressed }) => [
                styles.primary, darkMode && styles.primaryDark,
                pressed && styles.btnPressed,
              ]}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={darkMode ? darkColors.canvas : colors.paper} />
              ) : Platform.OS === 'ios' ? (
                <ExternalLink size={17} color={darkMode ? darkColors.canvas : colors.paper} />
              ) : (
                <Download size={17} color={darkMode ? darkColors.canvas : colors.paper} />
              )}
              <Text style={styles.primaryText}>
                {Platform.OS === 'ios'
                  ? 'View update'
                  : Platform.OS === 'android'
                  ? downloading
                    ? 'Downloading...'
                    : 'Download & Install'
                  : 'Download'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remind later"
              onPress={onDismiss}
              style={({ pressed }) => [styles.secondary, pressed && styles.btnPressed]}
            >
              <Text style={[styles.secondaryText, darkMode && styles.secondaryTextDark]}>Later</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 24, backgroundColor: 'rgba(20,24,21,0.44)',
  },
  card: {
    width: '100%', maxWidth: 460, maxHeight: '80%',
    borderRadius: radii.lg, padding: 22,
    backgroundColor: colors.paperStrong,
    borderWidth: 1, borderColor: colors.line,
    ...shadow.floating,
  },
  cardDesktop: { maxWidth: 520 },
  cardDark: { backgroundColor: darkColors.paperStrong, borderColor: darkColors.line },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 18 },
  textDark: { color: darkColors.ink },
  dismiss: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dismissPressed: { backgroundColor: colors.mossSoft },
  notes: { maxHeight: 220, marginBottom: 18 },
  notesText: { color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  notesTextDark: { color: darkColors.inkSoft },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primary: {
    flex: 1, height: 46, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 7,
    borderRadius: radii.pill, backgroundColor: colors.moss,
  },
  primaryDark: { backgroundColor: darkColors.moss },
  primaryText: { color: colors.paper, fontFamily: fonts.semibold, fontSize: 12 },
  secondary: {
    height: 46, justifyContent: 'center', paddingHorizontal: 16,
    borderRadius: radii.pill,
  },
  secondaryText: { color: colors.inkSoft, fontFamily: fonts.semibold, fontSize: 11 },
  secondaryTextDark: { color: darkColors.inkSoft },
  btnPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
});
