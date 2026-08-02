import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Supabase client initialised with AsyncStorage for session persistence.
 * Works in Expo Go, dev builds, and Electron without native config.
 *
 * - `flowType: 'pkce'` — OAuth returns an auth code in the query string that
 *   is exchanged for a session (works on web and in Electron, and the native
 *   sign-in in AuthContext uses the same flow). Implicit flow leaves
 *   `#access_token` in the URL which Electron's `will-navigate` guard would
 *   redirect to the OS browser.
 * - `detectSessionInUrl: true` on web/Electron so the auth code is captured
 *   after the Google redirect. Kept off on native where login is handled
 *   through expo-auth-session's in-app browser.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    flowType: 'pkce',
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export const isCloudConfigured = () =>
  Boolean(supabaseUrl) && supabaseUrl !== 'https://your-project-id.supabase.co';

export { supabaseUrl };
