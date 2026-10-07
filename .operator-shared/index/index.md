---
description: Shared codebase map of clairethomas.art (main branch) — static HTML/CSS/JS site plus Vercel functions.
read_if: Any code work on the portfolio site; start here before searching.
---

# Shared Project Index

## Architecture

- No build step. Every `*.html` page is a thin shell that sets `body[data-page]`; `site.js` renders nav, homepage slideshow, galleries, lightbox, About and Booking in the browser.
- Content (albums, photos, order, print flags) is one Cloudinary raw JSON asset served by `/api/content`; `cms-loader.js` fetches it and falls back to bundled `content/portfolio.json`.
- `api/` holds Vercel functions: public content, booking inquiry (Resend), and the admin session/save/upload/trash/shop-sync endpoints behind a signed `ct_admin` cookie.
- Settings Claire doesn't edit in the CMS live in config objects in `site.js`: `printShopConfig`, `navLabelOverrides`, `galleryConfig`, `bookingConfig`.
- Tests are `node --test scripts/*.test.mjs`, run with `npm run check`.

## Project Index

- `package.json` — Ditto (only the `check` script; no runtime deps on `main`)
- `vercel.json` — Security and cache headers per path
- `.vercelignore` — Deploy allowlist; see `specs/release-and-security.md` in the brain
- `.env.example` — Placeholder env names
- `.github/workflows/portfolio-shop-sync.yml` — Manual Gelato/Shopify product sync job
- `README.md`, `program.md` — Pre-overhaul descriptions; partly stale
- `PRINT_SHOP_SETUP.md` — Shopify + Gelato print shop setup and catalog
- `SERIES_WORKFLOW.md` — Old process for adding a series by hand (pre-CMS)
- `PLACEHOLDERS.md` — Placeholder values still in use
- `site.js` — All public rendering and site config objects
- `cms-loader.js` — Loads CMS content, then boots `site.js`
- `gallery-page.js` — `gallery.html?album=<key>` sets the page key for nested albums (e.g. Special occasions)
- `styles.css` — All public styles
- `admin.html`, `admin.js`, `admin.css` — Claire's content editor at `/admin.html` (strict CSP: self + Cloudinary only)
- `index.html` — Homepage (slideshow)
- `events.html`, `nature.html`, `street.html` — Portfolio sections (`protests`, `the-natural-world`, `shapes-and-shadows`)
- `gallery.html` — Generic album page for nested albums
- `booking.html`, `about-contact.html`, `prints.html` — Booking + inquiry form, About, prints landing
- `california.html`, `san-francisco.html`, `india.html`, `commissioned-work.html`, `street-abstractions.html`, `multiple-exposures.html`, `music.html`, `nyc.html`, `out-of-town.html`, `bts.html`, `self-reflections.html`, `workshops.html` — Legacy album pages; most albums no longer exist
- `about-contact-photo.JPG`, `assets/claire-thomas-logo.png` — About portrait fallback, logo
- `content/portfolio.json` — Bundled fallback content (older snapshot; not the live albums)
- `shopify-theme-overrides/` — Liquid override for Shopify product pages

### `api/` — Vercel functions

- `content.js` — Public CMS content read
- `inquiry.js` — Booking form → Resend email
- `admin/session.js`, `admin/content.js`, `admin/upload-signature.js`, `admin/empty-trash.js`, `admin/shop-sync.js` — Admin login, content save, signed Cloudinary upload, Trash purge, shop sync trigger
- `_lib/auth.js`, `_lib/http.js`, `_lib/cloudinary.js`, `_lib/content.js`, `_lib/inquiry.js`, `_lib/trash.js` — Shared helpers: session cookie, origin checks/JSON, Cloudinary API, content revisions, inquiry validation/sending, Trash deletion

### `scripts/` — Tests and one-off operations

- `*.test.mjs` — Node tests for CMS, inquiry, trash, print links, shop sync, Gelato, Shopify theme
- `create-admin-credentials.mjs`, `configure-vercel-admin-env.mjs` — Generate admin credentials; push them to Vercel production (state-changing)
- `seed-portfolio-content.mjs`, `export-portfolio-content.mjs` — Seed the CMS asset (empty clouds only); export bundled content
- `portfolio-print-sync.mjs`, `gelato-products.mjs`, `capture-shopify-credential.mjs` — Print shop sync tooling
- `upload-*.sh` — Legacy Cloudinary bulk uploads

## Other branches

- Branch-only code (Drive tools, client intake/Convex, Stripe pilot) is listed per workstream in `plans/work-board.md`, not here. Index it when it merges.
