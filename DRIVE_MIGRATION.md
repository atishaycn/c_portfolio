# One-time Google Drive sign-in

This is local migration tooling on `drive/album-folders`. It is not website sign-in and does not deploy anything.

## Google Cloud setup

An API key cannot authorize uploads or shortcut creation. In the Google Cloud project used for the Drive API key:

1. Enable the Google Drive API if it is not already enabled.
2. Open Google Auth Platform. Configure the app name as `Claire portfolio migration` and the support/contact email as your own. Use External audience unless your account belongs to an organization with an appropriate Internal audience. Keep the app in Testing and add the Google account that has write access to the destination Drive folder as a test user. Do not publish it for this one-time migration.
3. Configure data access for `https://www.googleapis.com/auth/drive.readonly` and `https://www.googleapis.com/auth/drive.file`.
4. Under Clients, create a **Desktop app** OAuth client named `Portfolio local migration`. Download its JSON.
5. Store the downloaded JSON as `.drive-migration.local/client.json` in this checkout. Do not paste the client secret or a token into chat. Protect the directory and file with `chmod 700 .drive-migration.local` and `chmod 600 .drive-migration.local/client.json`.

The first scope reads existing originals for matching. The second manages files created by or explicitly opened with this app. It does not request unrestricted write access to all Drive files. Shortcut creation against existing originals still needs a capability check after sign-in; if Google rejects it, stop rather than automatically request broader access.

## Connect locally

```sh
node scripts/drive-sign-in.mjs
```

Open the printed link in a browser on the same computer. Choose the account with write access to folder `1j_p4uDzt0QPy18iu5K9uKnkoYVphUzaD`. Approve the two requested Drive permissions yourself.

The callback listens only on `127.0.0.1:8765`, verifies state, and uses PKCE. It times out after ten minutes. This script only exchanges an OAuth code. It does not list, create, rename, delete, move, or share Drive files.

On success, `.drive-migration.local/token.json` holds an access token with owner-only permissions. No refresh token is requested or retained. The token typically expires after an hour; its actual expiry is stored as `expires_at`. Rerun sign-in if it expires. The local folder is excluded from Git and from Vercel's existing deployment allowlist.

## Read-only matching and review

After connection:

```sh
node scripts/drive-migration-plan.mjs
python3 scripts/drive-visual-review.py
```

The second command requires Pillow. The first snapshots current live content and scans only the supplied folder tree with GET requests. It verifies the backup sizes and compares MD5 fingerprints. The second downloads small public thumbnails without sending OAuth credentials to the image host, then compares image hashes, colors, and aspect ratios. Visual matches are candidates, never automatically approved.

Artifacts stay in `.drive-migration.local/`: `live-content.json`, `drive-inventory.json`, `plan.json`, `visual-matches.json`, and `review/index.html`. Serve **only** the review subdirectory, never the local credential directory:

```sh
python3 -m http.server 8770 --bind 127.0.0.1 --directory .drive-migration.local/review
```

Open `http://127.0.0.1:8770/`. The page shows each current website original alongside its exact match or closest search results. Unresolved search results must not be treated as matches.

Tests:

```sh
npm run check
python3 -B scripts/drive-visual-review.test.py
```

## Next gate

Review the dry-run mapping before writing to Drive. The old mapping and backups are evidence, not automatic approval of visual matches. To guarantee the same edits and crops, use shortcuts only for byte-exact matches and upload the backed-up website originals for all remaining photos. Reusing a non-exact visual candidate requires explicit approval.

The intended destination is `Website` inside the supplied folder, with Events, Nature, Street, Slideshow, and Special occasions inside Events. Preserve existing photo IDs, order, parent relationships, and print settings in the mapping. No folder creation, shortcut creation, upload, permission change, or production switch has been implemented by the sign-in script. Confirm the dry-run before those operations.

When the migration is complete, revoke this app's access through your Google Account connections page and remove the local token file. Never delete the source originals as part of cleanup.
