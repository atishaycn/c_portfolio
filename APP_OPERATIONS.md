# Portfolio operations

Use this for setup, content editing, deployment, recovery, or troubleshooting. For architecture and the dated production snapshot, read [APP_REFERENCE.md](APP_REFERENCE.md). Commerce is excluded.

## 1. Start safely

1. Inspect the checkout:

   ```bash
   cd /Users/sa/Developer/c_portfolio
   git branch --show-current
   git status --short
   ```

   **Done:** branch and all existing edits are accounted for. Current checkout is dirty; preserve unrelated work.

2. Choose read-only preview, isolated editing, or authorized production editing. The CMS raw asset ID is fixed in code. A local/preview server using production Cloudinary credentials can edit **production content**.

   **Done:** the target Cloudinary cloud is identified. Use a separate cloud for isolated CMS tests.

## 2. Preview static pages

1. Serve the repository:

   ```bash
   python3 -m http.server 8080
   ```

2. Open `http://localhost:8080/`.

   **Done:** HTML, styles, navigation, and gallery rendering load. This server has no Functions; admin authentication/saving cannot work here. The local loader may use bundled JSON; it does not prove live CMS behavior.

## 3. Run the full app locally

1. Use Node 24.x to match production and an installed Vercel CLI. No application dependency installation is needed.

   ```bash
   node --version
   vercel --version
   ```

   **Done:** both commands work; runtime differences are recorded.

2. Configure these names in trusted, ignored environment files. Use existing credentials for an authorized existing environment; use a separate Cloudinary cloud for isolated editing.

   | Variable | Purpose |
   | --- | --- |
   | `CLOUDINARY_CLOUD_NAME` | Target image/CMS cloud |
   | `CLOUDINARY_API_KEY` | Server-side Cloudinary authentication/signing |
   | `CLOUDINARY_API_SECRET` | Private Cloudinary secret |
   | `ADMIN_EMAIL` | Single allowed administrator |
   | `ADMIN_PASSWORD_HASH` | Salt plus hexadecimal scrypt hash |
   | `ADMIN_SESSION_SECRET` | Cookie-signing secret |

   Runtime Functions require the three separate Cloudinary variables; `CLOUDINARY_URL` alone is insufficient. Keep secrets out of Git, screenshots, and logs. `.env*`, local credential files, and `.vercel/` are ignored.

   **Done:** all six values exist for the selected environment without displaying them.

3. Start Functions and static hosting with the existing `.env` and `.env.local`:

   ```bash
   node --env-file=.env --env-file=.env.local -e '
   const {spawnSync} = require("node:child_process");
   const run = spawnSync("vercel", ["dev", "--listen", "8080", "--yes"],
     {stdio: "inherit", env: process.env});
   process.exit(run.status ?? 1);
   '
   ```

   **Done:** `/api/content` responds and `/admin.html` can complete login. Static-page success alone is insufficient. Verify cookie/login behavior in the chosen local browser.

### Fresh-environment branch only

These utilities change state. They are not ordinary startup steps:

- `node scripts/create-admin-credentials.mjs` generates credentials and **overwrites** `.env.local` and `.admin-credentials.local.json`. Use only when deliberately creating/replacing credentials.
- `node scripts/configure-vercel-admin-env.mjs` writes the six variables to **Vercel production** with forced replacement. Review the linked project and obtain production-change authority first.
- `node scripts/seed-portfolio-content.mjs` writes bundled JSON to the fixed CMS asset **without the normal previous-content backup**. Use only for an empty target cloud.

**Done:** credentials belong to the intended environment, the CMS was empty before any seed, and public/admin reads show the intended initial content.

## 4. Update content through admin

1. Open `/admin.html`, sign in, and inspect album/photo identity before editing. Keep one writer active.

   **Done:** the expected content is loaded, not a stale fallback snapshot.

2. Add/rename/nest/reorder albums or edit captions/order in the dashboard. Uploads go to Cloudinary and normally save automatically after the upload loop; ordinary edits require **Save**.

   **Done:** the editor reports save success. If uploads partially fail, preserve the open editor, inspect uploaded items, and resolve the unsaved state before retrying.

3. Check fresh `/api/content` and the public page for changed revision, correct photo IDs, captions, order, and image delivery.

   **Done:** the saved data and rendered result agree. No code deployment is required for normal CMS edits.

4. For deletion, use Trash restoration when needed; originals remain in Cloudinary.

   **Done:** restored items have the correct IDs, destination album, order, and captions, followed by a verified save.

About copy, logo/favicon, hardcoded label/order overrides, and styling require code edits/deployment, not an admin content save.

## 5. Deploy reviewed code

1. Review only intended code changes. A CLI deployment includes working-tree files, not just commits.

   ```bash
   git diff --check
   node --check site.js
   node --check cms-loader.js
   node --check admin.js
   node --test scripts/admin-cms.test.mjs
   ```

   **Done:** syntax/whitespace checks pass; every test failure is explained or fixed. The current CMS test has a stale 293-photo assertion. The broader `npm run check` covers additional modules outside this brief.

2. If deployment is authorized, verify the Vercel linkage and create a preview:

   ```bash
   vercel project inspect c-portfolio
   vercel
   ```

   **Done:** the preview serves the intended files. Check its environment before any admin save; preview credentials can still point at live CMS.

3. In Chrome, verify desktop and DevTools phone emulation: page load, fitting layout, sidebar collapse, links, gallery images, lightbox, About, and relevant console/network errors.

   **Done:** all changed surfaces work at both widths, and anonymous admin reads remain unauthorized.

4. Publish only after that verification:

   ```bash
   vercel --prod
   ```

   **Done:** Vercel reports Ready, the production alias serves the expected changed assets, and production checks repeat successfully. Git-triggered deployment behavior must be confirmed separately; a push alone is not deployment evidence.

### Drive-primary deployment acceptance

The local implementation has not been released. Before treating Drive migration as complete:

1. Validate every manifest photo ID against one current CMS snapshot and confirm the actual photo visually/content-wise. Counts and similar filenames do not establish 1:1 identity.
2. Verify each mapped file loads in a signed-out browser. Preserve existing Cloudinary IDs.
3. Deploy the resolver, loader, and manifest together through the reviewed process above.
4. Check production `/google-drive-manifest.json` returns 200; rendered image requests actually use Drive; verify grid and lightbox failure behavior independently.

**Done:** all expected active photos use the intended source, captions/order remain unchanged, and failure behavior is demonstrated. Admin thumbnails/uploads remain Cloudinary-backed unless separately changed.

## 6. Backup and restore

1. Before a risky edit, capture the current public snapshot:

   ```bash
   curl --fail --silent --show-error https://clairethomas.art/api/content \
     --output /tmp/claire-portfolio-before.json
   node -e 'const d=require("/tmp/claire-portfolio-before.json"); console.log({revision:d.revision,albums:d.albums.length,photos:d.albums.reduce((n,a)=>n+a.items.length,0)});'
   ```

   **Done:** revision and sample identities match authenticated authoritative content. Public HTTP 200 alone cannot rule out fallback data. Keep a dated copy outside `/tmp` for durable recovery.

2. Use admin Trash for individual-photo restoration. For a full historical restore, identify the intended `portfolio-cms/history/<timestamp>.json` and compare IDs, hierarchy, captions, and order against the requested revision.

   **Done:** the historical snapshot is the intended source; the current snapshot is backed up.

3. Restore through the authenticated save path using the **current revision for conflict checking**, with the chosen historical content. There is no built-in history-selector UI; this requires a scoped recovery procedure. Copying an old revision unchanged will fail the concurrency check.

   **Done:** a new revision is saved, backup exists, and public rendering matches the restored content.

**Recovery guardrails:** `export-portfolio-content.mjs` reconstructs old built-in gallery data; it is not an export of current live edits. The seed script bypasses the normal backup. Neither is a shortcut for recovering the edited portfolio.

## 7. Troubleshoot by symptom

| Symptom | Check first | Completion criterion |
| --- | --- | --- |
| Old photos/captions | API revision and IDs; server/browser fallback; deployed loader | Authoritative snapshot and rendered items agree |
| Drive files uploaded but site uses Cloudinary | Live resolver, manifest HTTP status, actual image URLs | Production requests intended Drive files |
| Grid works, lightbox fails | Source URL and local-path availability; separate fallback implementations | Selected image loads at both sizes |
| 401 / session expired | Login, cookie, configured email/secret, environment | Authenticated content GET works |
| 403 on save | CSRF header, origin host, current session | Authorized save succeeds without weakening checks |
| 409 on save | Another writer/current authoritative revision | Changes reconciled against freshly loaded content |
| Upload fails midway | Signature request vs direct Cloudinary response; partial uploaded state | Assets and saved CMS items reconcile without duplicates |
| Cloudinary content unavailable | Provider response, server logs, authenticated resource read | CMS reachable; fallback not mistaken for latest content |
| New album route fails | Stable key, `gallery.html?album=`, parent IDs, deployed generic handler | Correct album opens from navigation and direct URL |

This documentation work performed no production writes or deployments. Reverify environment-dependent facts when operating the app.
