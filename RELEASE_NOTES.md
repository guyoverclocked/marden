# Marden 1.0.4 — Maintained Markdown engine, richer reader

This release replaces the unmaintained Markdown display dependency with Software Mansion's actively maintained Enriched Markdown renderer. It keeps Marden's native Mermaid diagrams while giving ordinary Markdown a more complete, accessible rendering path.

## Renderer migration

- CommonMark and GitHub-Flavored Markdown rendering now use the maintained Enriched Markdown engine
- Native/browser text selection is built in, with plain Copy and Copy as Markdown actions on native platforms
- Tables, task lists, links, images, code, nested lists, accessibility semantics, RTL support, spoiler syntax, superscript, subscript, and standard double-equals highlights are supported by the renderer
- Reader task checkboxes now persist back into the local Markdown file
- Mermaid fences remain native Marden flowcharts; all other fenced code uses the new renderer's selectable code-block treatment

## Reader and writing improvements

- The reader keeps prose comfortably narrow on a laptop while tables and Mermaid diagrams take the full available reader width
- Small desktop tables now fill their table area; wide tables remain horizontally scrollable
- Nested bullets under numbered lists now retain correct indentation
- The writing toolbar includes a Highlight action that inserts portable standard Markdown highlight syntax
- Writing mode has a dedicated night-mode toggle, including preview and dialogs
- The desktop editor uses its available height instead of leaving a blank band above the writing surface
- Reading progress updates during macOS wheel scrolling and follows the same path on Android

## Native build requirement

The new renderer contains native code. Build or install a development/release app for Android or iOS; Expo Go is no longer supported for Marden. The included build configuration keeps native builds portable by disabling the renderer's optional LaTeX runtime.

## Install

- **Android:** download Marden-1.0.4.apk, open it, and approve installation from the browser or file manager if Android asks.
- **Apple Silicon Mac:** download Marden-1.0.4-macOS-arm64.dmg, drag Marden to Applications, then right-click Marden and choose **Open** the first time. This direct test build is not notarized.

Marden remains local-first: this release does not add accounts, cloud storage, analytics, or syncing.
