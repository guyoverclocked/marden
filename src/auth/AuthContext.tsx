import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase, isCloudConfigured, supabaseUrl } from '../supabase';
import { requestSync, subscribeToSyncState, syncNow as doSyncNow } from '../storage/syncEngine';
import { CloudSyncState } from '../types';

type AuthUser = {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
} | null;

type AuthContextValue = {
  user: AuthUser;
  isLoading: boolean;
  isLoggedIn: boolean;
  syncState: CloudSyncState;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isLoggedIn: false,
  syncState: 'disconnected',
  signInWithGoogle: async () => {},
  signOut: async () => {},
  syncNow: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// OAuth is completed in the system browser on native. This URI must be in the
// Supabase redirect allow-list. It is embedded in the native app at build time.
const nativeRedirectUri = 'marden://auth';

declare global {
  interface Window {
    mardenDesktop?: {
      openExternal: (url: string) => Promise<void>;
      onOpenMarkdown: (listener: (file: { name: string; content: string }) => void) => () => void;
    };
  }
}

// Completes a pending web popup when the app is rendered in a browser. Safe on
// native and required by expo-web-browser's web implementation.
void WebBrowser.maybeCompleteAuthSession();

const oauthErrorFromUrl = (url: string) => {
  const parsed = new URL(url);
  return parsed.searchParams.get('error_description') || parsed.searchParams.get('error');
};

const oauthCodeFromUrl = (url: string) => new URL(url).searchParams.get('code');

const currentWebRedirectUri = () => {
  if (typeof window === 'undefined') return undefined;
  // Works for a hosted web app and Electron's marden://app/index.html origin.
  return window.location.href.split('#', 1)[0].split('?', 1)[0];
};

const isDesktopApp = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && Boolean(window.mardenDesktop);

const userFromSession = (session: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } } | null): AuthUser => {
  if (!session) return null;
  const metadata = session.user.user_metadata ?? {};
  return {
    id: session.user.id,
    email: session.user.email ?? undefined,
    name: typeof metadata.full_name === 'string' ? metadata.full_name : undefined,
    avatarUrl: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : undefined,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncState, setSyncState] = useState<CloudSyncState>('disconnected');
  const hydratedRef = useRef(false);
  const signedInUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isCloudConfigured()) { setIsLoading(false); return; }

    const unsubscribeSyncState = subscribeToSyncState(setSyncState);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(userFromSession(session));
        signedInUserRef.current = session.user.id;
        void requestSync(setSyncState);
      } else {
        // Fall back to a network-verified user (the storage session may have
        // been cleared while the user is still signed in).
        supabase.auth.getUser().then(({ data: { user: authUser } }) => {
          if (authUser) {
            setUser(userFromSession({ user: authUser }));
            signedInUserRef.current = authUser.id;
            void requestSync(setSyncState);
          }
        }).catch(() => {});
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(userFromSession(session));
        // Sync immediately on sign-in so the cloud library appears right away.
        if (event === 'SIGNED_IN' && signedInUserRef.current !== session.user.id) {
          signedInUserRef.current = session.user.id;
          void requestSync(setSyncState);
        }
      } else if (event === 'SIGNED_OUT') {
        signedInUserRef.current = null;
        setUser(null);
        setSyncState('disconnected');
      }
    });

    // Re-sync when the app returns to the foreground (native only; the web
    // equivalent is the debounced requestSync on library changes).
    if (Platform.OS !== 'web') {
      const appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active' && hydratedRef.current) {
          void requestSync(setSyncState);
        }
      });
      hydratedRef.current = true;
      return () => {
        subscription.unsubscribe();
        appStateSub.remove();
        unsubscribeSyncState();
      };
    }

    return () => {
      subscription.unsubscribe();
      unsubscribeSyncState();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    // Desktop uses the operating system's default browser, which returns to
    // this app through Electron's marden:// protocol handler. A normal web
    // browser continues to use its own current URL as the redirect target.
    const desktopApp = isDesktopApp();
    const redirectTo = desktopApp || Platform.OS !== 'web' ? nativeRedirectUri : currentWebRedirectUri();

    if (!redirectTo || !supabaseUrl) throw new Error('Auth is not configured');

    // Start the PKCE flow through Supabase. This is important: Supabase stores
    // the matching verifier before opening Google, so exchangeCodeForSession
    // can safely complete the flow after the app is reopened.
    const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: desktopApp || Platform.OS !== 'web',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;

    if (desktopApp) {
      if (!oauthData.url) throw new Error('Could not start Google sign-in');
      // The desktop main process opens this in the user's default browser.
      // On completion it reloads the app at marden://app/?code=..., where
      // Supabase's PKCE client safely exchanges the one-time code.
      await window.mardenDesktop!.openExternal(oauthData.url);
      return;
    }

    if (Platform.OS === 'web') {
      // Supabase captures and exchanges the returned code from the current URL.
      return;
    }

    if (!oauthData.url) throw new Error('Could not start Google sign-in');
    const result = await WebBrowser.openAuthSessionAsync(oauthData.url, redirectTo);
    if (result.type !== 'success') return; // cancelled / dismissed

    const oauthError = oauthErrorFromUrl(result.url);
    if (oauthError) throw new Error(oauthError);
    const code = oauthCodeFromUrl(result.url);
    if (!code) throw new Error('Google sign-in did not return an authorization code');

    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    if (!sessionData.session) throw new Error('Could not start a session');
    // exchangeCodeForSession saves the session and emits SIGNED_IN, which the
    // listener above uses to set the user and trigger an initial sync.
    void requestSync(setSyncState);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    signedInUserRef.current = null;
    setUser(null);
    setSyncState('disconnected');
  }, []);

  const syncNow = useCallback(async () => {
    setSyncState('pending');
    await doSyncNow(setSyncState);
  }, []);

  const value = useMemo(() => ({
    user, isLoading, isLoggedIn: user !== null,
    syncState, signInWithGoogle, signOut, syncNow,
  }), [user, isLoading, syncState, signInWithGoogle, signOut, syncNow]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
