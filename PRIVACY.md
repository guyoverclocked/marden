# Marden Privacy Policy

Last updated: August 2, 2026

Marden is a local-first Markdown library and reader.

## Data Marden stores

Marden stores imported or created Markdown content as files in its private app document directory. Document metadata, project names, favourites, reader preferences, and reading progress are also stored locally on the user's device. This data is used only to provide the app's library, organization, editor, and reading features.

Cloud sync is optional. If a user chooses to sign in with Google and enable sync, Marden sends their Markdown documents, project names and colours, favourites, reading progress, and the associated modification timestamps to the Marden Supabase project. That data is stored per account and is used only to synchronize the user's library between their signed-in devices. Google supplies the account identity; Marden does not receive the user's Google password.

When a user explicitly exports a backup, Marden creates one portable backup file containing that library data and opens the device's save, download, or share flow. Marden does not upload the backup itself; the privacy terms of the destination selected by the user (such as a file provider or sharing app) apply from that point.

## Data collection

Marden does not require an account and does not include advertising or analytics SDKs. A user who does not sign in keeps their library solely on their device. A user who enables cloud sync sends the data described above to the Marden Supabase project.

Links and remote images inside a Markdown file may contact their destination when the user opens them or when the image is displayed. Those destinations have their own privacy practices.

## Deleting data

Users can delete individual documents from Marden. For signed-in users, deletion is synchronized to their other devices. Removing the app deletes its locally stored library and settings but does not itself delete cloud-synced data; users should first delete synced documents or request deletion through the contact channel below. Deleting an imported copy from Marden does not delete the original source file.

## Contact

For privacy questions about Marden, open an issue in the [Marden GitHub repository](https://github.com/guyoverclocked/marden/issues). Do not include private Markdown, personal information, or other sensitive content in a public issue.
