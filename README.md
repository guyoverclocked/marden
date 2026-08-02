# Marden

**A calm, local-first home for Markdown, ideas, and useful AI answers.**

Marden is a Markdown reader and library for Android, Apple-Silicon macOS, Windows, and the web. Capture a useful answer, import a `.md` file, or write from scratch; then organise it, read it comfortably, and optionally sync it privately across your own devices.

[Latest release](https://github.com/guyoverclocked/marden/releases/latest) · [Privacy](PRIVACY.md) · [Security](SECURITY.md)

## What it does

- Import, write, edit, rename, move, favourite, search, and delete Markdown documents.
- Open `.md`, `.markdown`, `.mdown`, and `.mkd` files from supported apps.
- Read Markdown with headings, lists, quotes, links, code blocks, tables, Mermaid diagrams, dark mode, adjustable type, outline, focus mode, find, copy, and saved reading position.
- Highlight reader text. Highlights are stored as standard `==highlighted text==` Markdown, so they export cleanly and sync with the document.
- Organise documents into colour-coded projects, or leave them Unfiled.
- Export and restore a portable Marden backup.
- Optionally sign in with Google and sync a private library through Supabase.
- Receive GitHub-release updates on Android and Windows.

Marden has no required account, ads, or analytics SDK. Without sign-in, the library stays on the device.

## Install

Download the appropriate asset from the [latest GitHub Release](https://github.com/guyoverclocked/marden/releases/latest).

| Platform | Download | Notes |
| --- | --- | --- |
| Android | `Marden-<version>.apk` | Open the APK and permit installs from your browser or file manager if Android asks. |
| Windows | `Marden-<version>-Windows.exe` | A universal NSIS installer for x64 and ARM64 Windows. |
| Apple Silicon Mac | `Marden-<version>-macOS-arm64.dmg` | Drag Marden to Applications. For the unsigned build, right-click → **Open** on first launch. |

The macOS package is for Apple-Silicon Macs only. It is unsigned and not notarized, so it is a manual-install build. A Developer ID certificate is required before reliable macOS automatic updates can be offered.

The published 2.0.1 release predates the universal-installer policy and therefore provides `Marden-2.0.1-Windows-x64.exe`. Subsequent releases use the universal Windows filename shown above.

## Updates

### Android

Marden checks the latest GitHub Release. When an update is available, it can download the new APK and open Android's installer. The user must approve the installation; Android does not allow a sideloaded app to install an update silently.

### Windows

Windows uses Electron's GitHub-release updater. A release must include both the universal Windows installer and the generated `latest.yml` manifest. Marden downloads updates automatically and installs them on the next launch.

### macOS

The app can show the latest release as a manual-download fallback. Automatic macOS updates are intentionally not advertised for unsigned builds because macOS requires a valid Developer ID signature for trusted updates.

## Optional private cloud sync

Cloud sync is optional. It stores documents, projects, reading progress, favourites, and Markdown highlights in your own Supabase project behind Row-Level Security.

### 1. Create the environment file

```bash
cp .env.example .env
```

Set the values in `.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

`.env` and `.env.*` are ignored by Git; only `.env.example` is tracked. Do not commit access tokens, Google client secrets, certificates, keystores, or production credentials.

The Supabase **anon** key is designed to be included in an app client. Security comes from correctly configured Row-Level Security policies, not from treating that key as a secret.

### 2. Create the database schema

In Supabase, open **SQL Editor**, paste the complete contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. The schema is idempotent, so it is safe to run again when upgrading an earlier Marden database.

It creates the `documents`, `projects`, and `preferences` tables, their indexes, Row-Level Security policies, and the incremental-sync RPC function.

### 3. Configure Google sign-in

1. In Supabase, open **Authentication → Providers → Google** and enable Google.
2. In Google Cloud Console, create an OAuth Web client and add the **Supabase callback URL displayed by the Google provider settings** as its authorised redirect URI.
3. Copy the Google client ID and client secret into Supabase. Keep the Google client secret in Supabase/Google Cloud only; never put it in this repository or `.env`.
4. In **Supabase Authentication → URL Configuration**, add these redirect URLs:

   ```text
   marden://auth
   marden://app/**
   ```

On desktop, clicking **Continue with Google** opens the user's default browser. Google returns through Supabase to `marden://auth`, which routes the completed sign-in safely back to Marden.

### 4. Verify sync

1. Install the same build on two devices.
2. Sign in with the same Google account on both.
3. Create or highlight a document on the first device.
4. Use **Profile → Sync now** on the other device, or wait for automatic sync.
5. Confirm the document and its highlights appear on the second device.

When two offline edits conflict, Marden keeps the newer version and preserves the losing local edit as a conflict copy rather than silently discarding it.

## Development

### Requirements

- Node.js 22.13 or newer
- npm
- An Expo development build for native-only testing
- Android Studio/Android SDK only for local Android builds
- An Apple-Silicon Mac for the macOS package

```bash
git clone https://github.com/guyoverclocked/marden.git
cd marden
npm install
cp .env.example .env # optional: only if testing cloud sync
npm start
```

Expo Go is useful for basic UI checks, but native file associations, the iOS share extension, and production OAuth flows require a development or release build.

## Quality checks

Run these before committing or releasing:

```bash
npm run typecheck
npm run doctor
npm run export:web
```

Suggested functional checks:

- Import and edit a Markdown file; confirm the original external file is unchanged.
- Select reader text and create a highlight.
- Sign in, confirm sync, then use **Profile → Sign out**. The profile should return to the sign-in state while the local library remains available.
- Test Google sign-in on desktop: it must open the default browser and return to Marden.
- Test Android's download-and-install update flow from a newer GitHub Release.

## Build

### Android APK with EAS

```bash
npx eas-cli@latest login
npm run build:apk
```

The preview profile creates an internal-distribution APK. EAS stores the Android signing key for the Expo account, so use the same account for future updates. A new Android release must increment `android.versionCode` in `app.json`.

### Desktop packages

```bash
# Apple-Silicon DMG only
npm run build:mac

# Universal Windows installer only
npm run build:win

# Both desktop deliverables
npm run build:desktop
```

Build outputs are written to `artifacts/`, which is ignored by Git.

## Release checklist

1. Update the app version in `app.json`, `package.json`, and `desktop/package.json`.
2. Increment Android `versionCode`; increment iOS `buildNumber` when creating an iOS build.
3. Run the quality checks.
4. Build the Android APK with EAS and download it into `artifacts/`.
5. Run `npm run build:desktop`.
6. Create a GitHub Release and upload only:

   ```text
   Marden-<version>.apk
   Marden-<version>-Windows.exe
   Marden-<version>-macOS-arm64.dmg
   latest.yml
   ```

   `latest.yml` is required for Windows OTA updates. Do not upload ZIPs, Intel macOS builds, or extra architecture-specific Windows installers.

7. Confirm `latest.yml` names the uploaded Windows installer and has the matching checksum before publishing the release.
8. Test the APK upgrade on an Android device and the updater check on a Windows installation.

## Privacy and security

- Marden is local-first; cloud sync is opt-in.
- Supabase Row-Level Security limits cloud rows to the signed-in user.
- No local secret file is committed. Check with `git status --ignored` and `git ls-files .env` before publishing.
- Imported Markdown is copied into Marden's private library; the source file is not modified.
- A shared or exported Markdown file may contain sensitive information. Review it before sending it elsewhere.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) for the complete policies.

## Contributing

Bug reports and focused pull requests are welcome. Include the platform, OS version, and a minimal non-sensitive Markdown sample when reporting a rendering issue. Never attach private notes, credentials, or copied AI conversations to a public issue.

Marden is released under the [MIT License](LICENSE).
