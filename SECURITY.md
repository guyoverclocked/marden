# Security notes

## User content boundary

Marden treats imported Markdown as untrusted local content:

- Raw HTML rendering is disabled.
- Automatic bare-URL linkification is disabled; explicit Markdown links still work.
- Imported documents are limited to 2 MB.
- Backup files use a versioned format that is validated before restore. Restore only merges new documents and never overwrites an existing document.
- Mermaid diagrams are parsed and drawn by Marden's native renderer; diagram source is not executed as JavaScript.
- Cloud sync is opt-in. Supabase Row-Level Security scopes every cloud record and sync query to the authenticated user.
- Restored backups discard cloud identifiers so their content cannot be written into the account that created the backup.

## Dependency audit note

Run `npm audit` before every release and address runtime production dependencies according to severity and exploitability. Expo Doctor is the compatibility authority for the pinned Expo SDK.
