import { Platform, Linking } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';

type LegacyFileSystem = {
  cacheDirectory: string | null;
  downloadAsync: (url: string, fileUri: string) => Promise<{ uri: string }>;
};

export type UpdateInfo = {
  version: string;
  releaseNotes: string;
  releaseUrl: string;
  apkUrl?: string;
  dmgUrl?: string;
  winUrl?: string;
  iosAppStoreUrl?: string;
};

const GITHUB_REPO = 'guyoverclocked/marden';
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const LAST_CHECK_KEY = 'marden.update.lastCheck.v1';
const CHECK_INTERVAL_MS = 86_400_000; // 24 hours

/**
 * Check GitHub Releases for a newer version. Throttled to once per 24 h to
 * stay well within the unauthenticated API rate limit (60 req/h).
 */
export async function checkForUpdate(
  currentVersion: string,
  storage: { setItem: (k: string, v: string) => Promise<void>; getItem: (k: string) => Promise<string | null> },
): Promise<UpdateInfo | null> {
  try {
    const lastCheck = await storage.getItem(LAST_CHECK_KEY);
    if (lastCheck && Date.now() - Number(lastCheck) < CHECK_INTERVAL_MS) return null;

    await storage.setItem(LAST_CHECK_KEY, String(Date.now()));

    const response = await fetch(GITHUB_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!response.ok) return null;

    const release = await response.json();
    const latestVersion = (release.tag_name || '').replace(/^v/, '');
    if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) return null;

    const apkAsset = release.assets?.find((a: any) =>
      a.name?.endsWith('.apk') && !a.name?.includes('universal'),
    );
    const dmgAsset = release.assets?.find((a: any) =>
      a.name?.endsWith('.dmg') && a.name?.includes('arm64'),
    );
    const winAsset = release.assets?.find((a: any) =>
      a.name?.endsWith('.exe') || a.name?.endsWith('.nsis.zip'),
    );

    return {
      version: latestVersion,
      releaseNotes: release.body || '',
      releaseUrl: release.html_url || GITHUB_RELEASES_URL,
      apkUrl: apkAsset?.browser_download_url,
      dmgUrl: dmgAsset?.browser_download_url,
      winUrl: winAsset?.browser_download_url,
    };
  } catch {
    return null;
  }
}

/**
 * Download an APK from GitHub Releases and open it with the system installer.
 * Android-only; no-op on other platforms.
 */
export async function downloadAndInstallApk(apkUrl: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  const target = new File(Paths.cache, 'marden-update.apk');
  await File.downloadFileAsync(apkUrl, target);
  const contentUri = await LegacyFileSystem.getContentUriAsync(target.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1,
    type: 'application/vnd.android.package-archive',
  });
}

export function openDownloadUrl(url: string): void {
  void Linking.openURL(url);
}

// ── helpers ───────────────────────────────────────────────────────────────

function compareVersions(a: string, b: string): number {
  const ap = a.split('.').map(Number);
  const bp = b.split('.').map(Number);
  for (let i = 0; i < Math.max(ap.length, bp.length); i += 1) {
    const diff = (ap[i] || 0) - (bp[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
