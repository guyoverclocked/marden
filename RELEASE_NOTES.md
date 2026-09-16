# Marden 2.0.1 — Markdown export and bulk library actions

Marden 2.0.1 makes it easier to take Markdown back out of the app, organise several documents together, and rely on local copies when a device is offline.

## What’s new

- Export a document as a real `.md` file from the reader toolbar or its library action menu
- Select multiple library documents—or select all—and move, export, or delete them in one action
- Undo a bulk deletion before it is committed and synced to other signed-in devices
- Assign a batch of newly imported Markdown files to a project immediately after import
- Download exported files in the desktop app and use the native share sheet on Android and iOS

## Reliability improvements

- Repair missing native document files after the library loads or receives synced changes
- Keep a document visible when its expected local file is missing or unreadable, using an available fallback copy when possible
- Reduce unnecessary document-card rerenders during library interactions

## Download and install

- **Android:** download `Marden-2.0.1.apk`, open it, and approve installation from the browser or file manager if Android asks.
- **Windows:** download `Marden-2.0.1-Windows.exe` for the universal x64/ARM64 installer. Architecture-specific installers are also attached.
- **Apple-Silicon macOS:** download `Marden-2.0.1-macOS-arm64.dmg`, drag Marden to Applications, then right-click and choose **Open** on first launch if macOS displays an unnotarized-app warning.
- **Integrity:** compare a download against `Marden-2.0.1-SHA256SUMS.txt` if you want to verify it.

### Android 2.0.0 users: one-time reinstall required

The Android signing certificate changed for 2.0.1, so Android cannot install this APK over 2.0.0. Before uninstalling 2.0.0, export a library backup (especially if you do not use sync). Then uninstall 2.0.0 and install 2.0.1. Uninstalling clears Marden’s local app data.

Marden remains local-first. An account is optional, and cloud sync is only used after sign-in.
