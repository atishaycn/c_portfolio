# Program Brief

## Purpose

Static photography portfolio for Claire Thomas. The site is a multi-page HTML/CSS/JS portfolio with a shared client-side renderer in `site.js`, a shared stylesheet in `styles.css`, and one lightweight HTML entrypoint per section.

## Important Files And Boundaries

- `site.js`: shared navigation, gallery data, detail-page rendering, and lightbox behavior.
- `styles.css`: shared site layout and page-specific styling.
- `*.html`: individual entrypoints that set `body[data-page]` and load the shared assets.
- `Place/`, `The Natural World/`, `Protests/`, `Shapes & Shadows/`: image assets. Treat as content, not app logic.
- `scripts/`: utility scripts for Cloudinary upload workflows.
- `.vercel/`: deployment linkage/config created by Vercel CLI.

Keep content image directories and generated deployment metadata out of scope unless the task specifically requires them.

## Run And Verify

- Local static check: `python3 -m http.server 8080`
- Open the relevant page directly in a browser, or hit `http://localhost:8080/<page>.html`
- For navigation changes, verify the sidebar link state and destination page.
- For layout changes, verify both desktop and narrow/mobile widths.

## Current Operating Brief

- Prefer small, attributable edits in `site.js`, `styles.css`, and the relevant HTML entrypoint.
- New sections should usually be added as a new `*.html` file plus a small `render...` branch in `site.js`.
- Keep the visual language minimal and consistent with the existing site unless explicitly asked to redesign it.
- After material workflow or structure changes, refresh this file so future sessions inherit the current repo shape.
