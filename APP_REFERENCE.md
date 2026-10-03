# Portfolio app reference

Scope: public portfolio, content manager, hosting, authentication, and media. Commerce is excluded. For setup, content changes, deployment, recovery, or troubleshooting, read [APP_OPERATIONS.md](APP_OPERATIONS.md).

## 1. What is actually in production

Read-only inspection: October 2, 2026. This is a dated snapshot, not a deployment guarantee.

| Surface | Verified state |
| --- | --- |
| Website | `https://clairethomas.art/`; Vercel production deployment Ready |
| Deployment | `dpl_6rmzScXn8avX1yrE3AAWcYwFRNp7`, created September 21, 2026 |
| Code | Live `site.js`, `cms-loader.js`, and `admin.js` match Git HEAD `31238735c536bc02807f6497cbc8956948859ca2` |
| Portfolio data | `/api/content`: revision **187**, 8 albums, **246 active photos**, 120 trash entries, 1 group |
| Last content timestamp | `2026-08-06T16:34:43.953Z` |
| Photo delivery | **Cloudinary**: all 246 active items have `publicId`; none have `driveFileId` |
| Drive delivery | **Not deployed**: live renderer/loader have no Drive resolver; `/google-drive-manifest.json` returns 404 |
| Bundled JSON | Production `content/portfolio.json` is older: revision 0, 7 albums, 293 photos |
| Authentication boundary | Anonymous session check succeeds with `authenticated: false`; anonymous admin-content read returns 401 |

Live `/api/content` response SHA-256: `c42c90be7c8ffc77cc4e0e9b4f1b3487b61065a61b4cddb43cbe9de3e3266db0`. The public Cloudinary CMS asset also returned revision 187 with matching counts.

**Intent versus deployment:** the user requested Drive as the primary image source. The working tree implements Drive-first resolution and contains a version-5 manifest with 246 mappings, but those changes are uncommitted and absent from production. “Optional” describes the per-photo resolver capability; it does not describe the intended migration outcome. Mapping count alone does not prove the photographs are correctly matched.

## 2. System map

```text
Visitor browser
  ├─ HTML / CSS / JavaScript / logo ← Vercel static hosting
  └─ GET /api/content              → Vercel Function
                                      └─ Cloudinary raw JSON
          ↓ albums, captions, order, image IDs
     site.js builds navigation, galleries, and lightbox
          └─ image requests directly → Cloudinary image delivery

Admin browser
  ├─ sign in / load / save JSON    → Vercel Functions → Cloudinary raw JSON
  └─ obtain signed upload         → Vercel Function
          └─ upload image bytes directly → Cloudinary
```

The undeployed Drive branch changes the visitor's last image-request destination to Google Drive for mapped photos. It leaves the CMS, authentication, and admin uploads on Cloudinary.

## 3. Hosting and code

The app uses vanilla HTML, CSS, and JavaScript. There is no frontend framework, bundler, SQL database, or continuously running application server in this non-commerce path. Vercel serves static files and runs Node serverless handlers on demand.

| File / directory | Responsibility |
| --- | --- |
| `*.html` | Page entrypoints; `body[data-page]` selects a gallery or special page |
| `cms-loader.js` | Fetch content before loading `site.js` |
| `site.js` | Built-in fallback gallery data, CMS integration, sidebar, About, galleries, lightbox, image URLs |
| `gallery.html`, `gallery-page.js` | New albums: `gallery.html?album=<stable-key>`; accepted keys contain lowercase letters, digits, and hyphens |
| `styles.css` | Public layout and responsive styles |
| `assets/claire-thomas-logo.png` | Tracked logo and favicon |
| `admin.html`, `admin.js`, `admin.css` | Authenticated editor UI |
| `api/content.js` | Public content read |
| `api/admin/` | Login/session, protected content, upload signatures |
| `api/_lib/` | Authentication, HTTP handling, validation, Cloudinary storage |
| `content/portfolio.json` | Bundled fallback snapshot, not the live editing database |
| `google-drive-manifest.json` | Local photo-ID → Drive-file-ID overlay; absent from current deployment |
| `scripts/` | Checks, bootstrap, legacy media uploads, and snapshot utilities |
| `vercel.json`, `.vercel/` | Response-header rules and ignored local project linkage |

Verified Vercel project: `c-portfolio`, scope `atishay-jains-projects-b62c3561`, root `.`, framework “Other”, Node **24.x**. The inspected non-commerce Functions run in **iad1**. There is no build script in `package.json`.

Aliases include `clairethomas.art`, `www.clairethomas.art`, and `c-portfolio-xi.vercel.app`. DNS inspection found apex A `76.76.21.21` and `www` CNAME `cname.vercel-dns.com`. Registrar, billing tier, retention guarantees, and automatic Git deployment triggers were not verified.

Repository: `https://github.com/atishaycn/c_portfolio.git`, branch `main`. The working tree is dirty; local files are not proof of deployed behavior.

## 4. Where data lives

| Data | Store | How it changes |
| --- | --- | --- |
| Page code, styles, logo | Git checkout → Vercel deployment | Reviewed code deployment |
| Albums, hierarchy, captions, ordering, trash | Cloudinary raw asset `portfolio-cms/content.json` | Admin saves a complete JSON snapshot |
| Original uploaded photos | Cloudinary image assets | Browser sends signed uploads directly to Cloudinary |
| Resized public images | Cloudinary delivery URLs | Requested transformations; separate from CMS JSON |
| Previous CMS snapshots | Cloudinary raw `portfolio-cms/history/<timestamp>.json` | Backup created before each normal save |
| Emergency bundled content | `content/portfolio.json`; built-in arrays in `site.js` | Code/file changes; can lag live edits |
| Drive originals and mappings | Drive files; local manifest or per-item `driveFileId` | Separate mapping/deployment workflow, not admin uploads |
| Login configuration | Server environment variables | Credential/configuration changes |
| Browser session | Signed `ct_admin` cookie | Login/logout/expiry |
| Unsaved edits, selected album, image preload cache | Browser memory | Lost on reload; dirty editor warns before leaving |

Public CMS URL: `https://res.cloudinary.com/dpmdkrggj/raw/upload/portfolio-cms/content.json`.

This raw asset is publicly readable, including trash metadata. It is not a private vault. Removing an item from the portfolio does not delete its Cloudinary original. Local Finder originals are recovery material, not a production storage dependency.

## 5. Content identity and navigation

The normalized document contains `version`, `revision`, `updatedAt`, `groups`, `albums`, and `trash`.

- Groups: stable `id`, `label`, `order`, optional `parentId`.
- Albums: stable `id` and route `key`, `label`, `path`, `order`, `parentId`, `preserveCase`, and `items`.
- Photos: stable `id`, Cloudinary `publicId`, optional `driveFileId`, `title`, `location`, `width`, `height`, and `order`.
- Trash: original `albumId`, deletion timestamp, and the preserved item.

Other existing compatibility fields remain in the document but are outside this brief. Preserve them during any round-trip.

Use **photo ID** for identity; order, captions, folder names, and filenames are not identity. Renaming an album label does not rename its IDs. `parentId` controls nesting; numeric order controls ordering, subject to frontend overrides.

The renderer labels `protests` as **events**, puts it first, and labels `commissioned-work` as **portraits**. Those internal keys remain unchanged. About text is hardcoded in `site.js`, not editable CMS content. Legacy HTML entrypoints exist but need not appear in current CMS-driven navigation.

Validation rejects duplicate identities, unknown parents, and hierarchy cycles. Limits include 100 albums, 5,000 active photos, and 1,000 retained trash records; trash is sliced to that limit, not used to delete original image assets. Captions are limited to 2,000 characters and locations to 500. Validation checks shape/identity, not whether an image exists or depicts the intended photograph.

## 6. Read, save, and upload flows

### Public read

1. HTML loads `cms-loader.js`.
2. Loader fetches `/api/content` with browser `cache: "no-store"`.
3. Function reads public Cloudinary JSON, normalizes it, and returns it. If the remote read fails, server code can return bundled JSON.
4. Loader exposes `window.__PORTFOLIO_CONTENT__` and loads `site.js`.
5. Renderer uses CMS content; built-in gallery arrays remain the client fallback when no content arrives.

The local loader additionally tries bundled JSON in the browser and overlays the Drive manifest before rendering. Those extra steps are **not in the deployed loader**.

An HTTP 200 can contain fallback content. Check revision, IDs, and captions when proving freshness. Code declares a 30-second shared cache and 300-second stale window, but the observed live response exposed `Cache-Control: public, max-age=0`; do not assume the declared CDN behavior is active. Admin responses are no-store.

### Admin save

1. Login establishes a signed session; dashboard reads authenticated content and retains its revision.
2. Edits change the browser's in-memory snapshot; ordinary edits require **Save**.
3. `PUT /api/admin/content` checks session, CSRF, origin, document validity, and current authoritative revision.
4. Server reads Cloudinary's authenticated resource metadata/version, rather than relying only on public-CDN content.
5. Matching revision: back up current JSON, write replacement JSON, increment revision, update timestamp. Changed revision: **409**, requiring reload/reconciliation.

This is an optimistic conflict check, not an atomic database transaction. Two concurrent writers could pass the read/compare stage before either writes. Use one writer. Backup failure stops the normal current-asset write; a later write failure can leave a backup without a completed save.

### Admin upload

1. Browser requests a protected upload signature for the selected album.
2. Function signs a unique `portfolio-admin/<album-key>/<UUID>` public ID with overwrite disabled.
3. Browser sends image bytes directly to Cloudinary; the Function does not relay the image file.
4. Returned public ID/dimensions become a new stable photo item.
5. After the upload loop succeeds, admin saves the content snapshot automatically.

Uploads are sequential and not transactional. A partial failure can leave earlier assets uploaded and edits only in memory. Preserve the open editor and inspect state before retrying. Admin thumbnails and uploads remain Cloudinary-only; the connected Codex Drive plugin is not a website runtime dependency.

### Delete and restore

Photo deletion moves metadata to trash and retains the original image. Album deletion moves its photos to trash and reparents children. Restore returns a photo to its original album if available, otherwise an existing album; it preserves photo identity. Full historical-document recovery is separate from the trash UI.

## 7. Image delivery and performance

Production requests Cloudinary URLs using cloud `dpmdkrggj`, automatic format/quality, and width-limited transformations. Grid target is 1,200 px; lightbox target is 2,400 px. Responsive variants span 400–2,400 px. Tiny blurred placeholders load first; the first four gallery images upgrade eagerly, and remaining images upgrade near the viewport. Adjacent lightbox images preload in memory.

Local Drive-first delivery uses `https://drive.google.com/thumbnail?id=<FILE_ID>&sz=w<width>` for mapped photos. Files must be viewable by visitors without signing in. There is no app Drive OAuth, service account, API upload integration, or automatic folder discovery. Adding a Drive file does not automatically add a website photo.

**Fallback caveat:** grid handling can use a local path when present, otherwise a Cloudinary URL. Lightbox fallback depends on an actual local `image` path; normalized CMS items usually lack one. A universal Drive → Cloudinary → local recovery chain is not implemented. Many local photo files are ignored by Git and are not guaranteed to exist on Vercel.

Provider quotas still matter. Responsive images and lazy loading reduce delivery demand; current allowances, throttling, and charges were not inspected. Drive folder storage capacity alone does not establish dependable public image delivery.

## 8. APIs and security

| Endpoint | Methods | Access / purpose |
| --- | --- | --- |
| `/api/content` | GET | Public normalized portfolio JSON |
| `/api/admin/session` | GET, POST, DELETE | Session status, login, logout |
| `/api/admin/content` | GET, PUT | Authenticated authoritative read and save |
| `/api/admin/upload-signature` | POST | Authenticated signed Cloudinary upload parameters |

One configured admin email; no application user database, role system, OAuth, password-reset UI, or MFA. Password verification uses salted scrypt and timing-safe comparison. Session payload is HMAC-SHA256 signed, **not encrypted**, and expires after seven days.

Cookie flags: HttpOnly, Secure, SameSite=Strict, path `/`. Protected mutations require `X-CSRF-Token`. Origin checks compare the request origin's host with the server host when an Origin header is present; absent Origin is accepted. Login is the unauthenticated mutation exception.

Logout clears the browser cookie; there is no server-side session registry for individual-token revocation. Rotating the session secret invalidates existing sessions. No explicit application login rate limiter or security audit trail was found; platform-level protections were not inspected.

Admin HTML is no-store, noindex, frame-denied, and has a restrictive CSP. Its image policy permits Cloudinary, not Drive. Public JSON and Cloudinary public image URLs remain accessible without admin authentication. API secrets stay server-side; the upload response includes the public Cloudinary API key, not the API secret.

## 9. Other public behavior

The sidebar uses native collapsible `details`; active nested groups open initially. Collapse state is not saved across reloads. At 820 px or narrower, the sidebar becomes a top section and galleries use one column. The About layout becomes one column at 1,100 px.

Email is a `mailto:contact@clairethomas.art` link, not a submitted backend form. Writing links to Substack; Instagram links to `cet.samoht`; the newsletter uses external Substack. Email hosting was not verified. No application analytics SDK, service worker, or localStorage/sessionStorage persistence was found in inspected source.

## 10. Verification boundaries

This inspection fetched live code/content, checked Vercel hosting/DNS and anonymous API behavior, and inspected local code. It did not perform production writes, uploads, authenticated login, deployment, billing changes, or browser E2E.

`node --test scripts/admin-cms.test.mjs`: **6/7 passed**. One stale assertion expects 7 albums/293 photos; the current local fallback has 8 albums/246 photos. Passing validation/auth tests are not proof of a successful live save.

Recheck live resolver, manifest availability, content revision, and authenticated behavior after any deployment. Read the operational steps before touching credentials, seeding, or restoring content.
