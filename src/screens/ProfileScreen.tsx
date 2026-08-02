import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Cloud, CloudOff, LogOut, RefreshCw, Shield, X } from 'lucide-react-native';
import { useAuth } from '../auth/AuthContext';
import { isCloudConfigured } from '../supabase';
import { colors, darkColors, fonts, radii, shadow } from '../theme';

type ProfileScreenProps = {
  darkMode: boolean;
  onClose: () => void;
};

export function ProfileScreen({ darkMode, onClose }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const desktop = windowWidth >= 900;
  const theme = darkMode ? darkColors : colors;
  const { user, isLoading, syncState, signInWithGoogle, signOut, syncNow } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'Your local library stays on this device. You can sign in again anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try { await signOut(); } catch {}
          setSigningOut(false);
          onClose();
        },
      },
    ]);
  };

  const handleSync = async () => {
    setSyncing(true);
    await syncNow();
    setSyncing(false);
  };

  const syncDotColor = syncState === 'synced'
    ? '#5A9A6B'
    : syncState === 'pending'
    ? '#D4A24E'
    : syncState === 'error'
    ? '#E58D83'
    : '#A3ADA6';

  return (
    <Modal animationType="slide" visible onRequestClose={onClose}>
      <SafeAreaView edges={['top']} style={[styles.safe, darkMode && styles.safeDark]}>
        <View style={[styles.header, darkMode && styles.headerDark]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close profile"
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <ChevronLeft size={24} color={theme.ink} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.headerTitle, darkMode && styles.textDark]}>Profile</Text>
          <View style={styles.closeBtn} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, desktop && styles.scrollDesktop]}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.moss} />
            </View>
          ) : user ? (
            <>
              <View style={[styles.profileCard, darkMode && styles.cardDark]}>
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, darkMode && styles.avatarPlaceholderDark]}>
                    <Text style={styles.avatarLetter}>
                      {(user.name || user.email || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={[styles.userName, darkMode && styles.textDark]}>
                  {user.name || 'Marden user'}
                </Text>
                <Text style={[styles.userEmail, darkMode && styles.textSoftDark]}>{user.email}</Text>
              </View>

              <View style={[styles.section, darkMode && styles.cardDark]}>
                <View style={styles.sectionHeader}>
                  <Cloud size={18} color={theme.moss} />
                  <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Cloud Sync</Text>
                </View>
                <View style={styles.syncRow}>
                  <View style={[styles.syncDot, { backgroundColor: syncDotColor }]} />
                  <Text style={[styles.syncLabel, darkMode && styles.textDark]}>
                    {syncState === 'synced'
                      ? 'All changes synced'
                      : syncState === 'pending'
                      ? 'Syncing...'
                      : syncState === 'error'
                      ? 'Sync failed — tap to retry'
                      : 'Disconnected'}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sync now"
                    disabled={syncing}
                    onPress={handleSync}
                    style={({ pressed }) => [styles.syncBtn, pressed && styles.pressed]}
                  >
                    {syncing ? (
                      <ActivityIndicator size="small" color={theme.moss} />
                    ) : (
                      <RefreshCw size={16} color={theme.moss} />
                    )}
                  </Pressable>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                disabled={signingOut}
                onPress={handleSignOut}
                style={({ pressed }) => [
                  styles.signOutBtn, darkMode && styles.signOutBtnDark, pressed && styles.pressed,
                ]}
              >
                {signingOut ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <LogOut size={18} color={colors.error} />
                )}
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </>
          ) : isCloudConfigured() ? (
            <View style={[styles.section, darkMode && styles.cardDark]}>
              <View style={styles.cloudIconWrap}>
                <CloudOff size={32} color={theme.moss} />
              </View>
              <Text style={[styles.cloudTitle, darkMode && styles.textDark]}>Sign in to sync</Text>
              <Text style={[styles.cloudBody, darkMode && styles.textSoftDark]}>
                Your Markdown library stays on this device. Sign in to read and write on all your devices.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google"
                onPress={() => signInWithGoogle().catch(() => {})}
                style={({ pressed }) => [styles.googleBtn, pressed && styles.googleBtnPressed]}
              >
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </Pressable>
              <View style={[styles.privacyRow, darkMode && styles.privacyRowDark]}>
                <Shield size={14} color={theme.inkFaint} />
                <Text style={[styles.privacyText, darkMode && styles.textSoftDark]}>
                  Marden uses Supabase Auth with Row‑Level Security. Only you can access your files.
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.section, darkMode && styles.cardDark]}>
              <Text style={[styles.cloudBody, darkMode && styles.textSoftDark]}>
                Cloud sync is not configured yet. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  safeDark: { backgroundColor: darkColors.canvas },
  header: {
    height: 68, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line, backgroundColor: colors.paper,
  },
  headerDark: { borderBottomColor: darkColors.line, backgroundColor: darkColors.paper },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
  closeBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.58, transform: [{ scale: 0.95 }] },
  scroll: { padding: 20, paddingBottom: 60 },
  scrollDesktop: { maxWidth: 640, alignSelf: 'center', width: '100%' },
  loading: { marginTop: 60, alignItems: 'center' },
  profileCard: {
    alignItems: 'center', padding: 28, borderRadius: radii.lg,
    backgroundColor: colors.paperStrong, borderWidth: 1, borderColor: colors.line,
    marginBottom: 16,
  },
  cardDark: { backgroundColor: darkColors.paperStrong, borderColor: darkColors.line },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 14 },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36, marginBottom: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.mossSoft,
  },
  avatarPlaceholderDark: { backgroundColor: darkColors.mossSoft },
  avatarLetter: { color: colors.moss, fontFamily: fonts.bold, fontSize: 24 },
  userName: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 17, marginBottom: 4 },
  userEmail: { color: colors.inkFaint, fontFamily: fonts.regular, fontSize: 12 },
  textDark: { color: darkColors.ink },
  textSoftDark: { color: darkColors.inkSoft },
  section: {
    padding: 20, borderRadius: radii.lg,
    backgroundColor: colors.paperStrong, borderWidth: 1, borderColor: colors.line,
    marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  syncLabel: { flex: 1, color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 12 },
  syncBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cloudIconWrap: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.mossSoft, alignSelf: 'center', marginBottom: 16,
  },
  cloudTitle: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 18, textAlign: 'center', marginBottom: 8 },
  cloudBody: { color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  googleBtn: {
    marginTop: 20, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.pill, backgroundColor: colors.moss,
  },
  googleBtnPressed: { opacity: 0.82 },
  googleBtnText: { color: colors.paper, fontFamily: fonts.semibold, fontSize: 13 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16 },
  privacyRowDark: { borderTopColor: darkColors.line },
  privacyText: { flex: 1, color: colors.inkFaint, fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 15 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: radii.lg,
    backgroundColor: colors.paperStrong, borderWidth: 1, borderColor: '#F0D9D6',
  },
  signOutBtnDark: { backgroundColor: darkColors.paperStrong, borderColor: '#4A2926' },
  signOutText: { color: colors.error, fontFamily: fonts.semibold, fontSize: 12 },
});
