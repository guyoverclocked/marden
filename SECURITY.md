# Security notes

## User content boundary

Marden treats imported Markdown as untrusted local content:

- Raw HTML rendering is disabled.
- Automatic bare-URL linkification is disabled; explicit Markdown links still work.
- Imported documents are limited to 2 MB.
- Mermaid diagrams are parsed and drawn by Marden's native renderer; diagram source is not executed as JavaScript.
- The app does not upload Markdown to a developer-operated service.

## Dependency audit note

As of July 15, 2026, `react-native-markdown-display` depends on `markdown-it` and `linkify-it`, for which npm reports GHSA-22p9-wv53-3rq4 with no published fix. The affected automatic link-matching path is explicitly disabled in `MarkdownRenderer.tsx`, and imports are size-limited. Track the upstream packages and upgrade when a patched compatible release is available.

The moderate `uuid` advisory reported beneath Expo's native configuration tooling is not part of Marden's runtime data path. Expo Doctor is the compatibility authority for the pinned Expo SDK and currently passes all checks.
