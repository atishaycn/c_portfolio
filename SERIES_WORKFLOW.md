# Series Addition Workflow

This document defines the standard process for adding a new portfolio series to this project.

## What I will provide

For each new series, I will provide only:

1. **Series name**
2. **Where it should appear in navigation**
3. **Image folder/path**

Example:

```txt
Series name: San Diego
Add under: place > California
Image folder: Place/California/San Diego
```

---

## Required working style

For every series addition:

- **Share updates at each step** so progress is visible while the work is being completed.
- **Do the full implementation**, not just partial wiring.
- **Commit and push changes** once everything is complete and verified.
- **Do not commit source gallery image assets** (`Place/`, `The Natural World/`, etc.); keep them local and rely on Cloudinary for deployed delivery.
- **Use the available signed-in Vercel setup** to verify deployment after pushing.
- Report any concrete blocker clearly if something prevents completion.

---

## Standard process for adding a new series

### 1. Confirm the target placement in the portfolio structure
Determine whether the new series is:

- a **top-level gallery**
- a **child gallery**
- a **nested child gallery**

Examples:

- `top level`
- `place > California`
- `place > California > San Francisco`

---

### 2. Normalize the series for implementation
From the provided series name, derive:

- internal key
- HTML filename
- nav label
- display label

Conventions:

- HTML filename: lowercase kebab-case
- internal key: lowercase kebab-case
- nav label: preserve intended display formatting where appropriate

Example:

- `Shapes & Shadows`
- file: `shapes-and-shadows.html`
- key: `shapes-and-shadows`

---

### 3. Normalize image filenames before wiring the gallery
All image filenames in the provided folder must be renamed to:

- `1.ext`
- `2.ext`
- `3.ext`
- ...
- `n.ext`

Rules:

- preserve the actual file extension
- use sequential numbering in intended display order
- remove inconsistent naming, spaces, camera-generated names, duplicates, or mixed numbering styles
- final gallery order must match the renamed sequence exactly

Examples:

- `IMG_8821.jpg` → `1.jpg`
- `DSC_1044.jpg` → `2.jpg`
- `edit-final.JPG` → `3.JPG`

This renamed order becomes the canonical source order for:

- local gallery references
- spec arrays
- Cloudinary uploads

---

### 4. Inspect the folder and build gallery metadata
After renaming:

- enumerate all images in numeric order
- capture for each image:
  - filename
  - width
  - height

Then generate the section spec array in `site.js`.

Pattern:

```js
const sanDiegoSpecs = [
  ["1.jpg", 5184, 3456],
  ["2.jpg", 3888, 5184],
  ["3.jpg", 5125, 3844],
];
```

---

### 5. Create or wire the gallery page
Add a dedicated HTML page for the new series using the standard project template:

- page title
- placeholder description unless otherwise instructed
- `body data-page="series-key"`
- shared `styles.css`
- shared `site.js`

Pattern:

```html
<body data-page="series-key">
```

---

### 6. Register the series in `site.js`
Add the new gallery to `galleryPages` with:

- `key`
- `label`
- `path`
- `items`

Use the project’s standard helper pattern.

Example:

```js
items: createLocalGalleryItems("san-diego", "Place/California/San Diego", sanDiegoSpecs, {
  publicIdBase: "place/california/san-diego",
})
```

This keeps:

- local file path support during local development
- Cloudinary support for deployed delivery
- consistent rendering
- local fallback behavior where local assets are present outside git

---

### 7. Add the series to sidebar navigation
Update `portfolioLinks` so the new section appears exactly where requested.

Rules:

- top-level sections become direct links
- nested sections go under `children`
- existing hierarchy should be preserved
- active/open folder behavior should continue to work

---

### 8. Upload only the new series to Cloudinary using the local script
After local integration, upload **only the newly added series** to Cloudinary using the **locally available upload script pattern**.

Requirements:

- use the project’s existing local Cloudinary upload workflow
- do **not** re-upload unrelated existing galleries unless explicitly needed for a fix
- upload every image in the new series
- ensure Cloudinary public IDs follow the folder hierarchy convention already used in the project
- wire the gallery so Cloudinary is the served source and local files remain fallback where applicable
- prefer targeted uploads by explicit series key/path rather than a blanket upload of every place gallery
- when adding multiple independent new series, uploads may be run in parallel if the local script supports it and output remains verifiable
- on this machine, prefer `PARALLEL=2` as the safe default for Cloudinary uploads; higher values may hit local `curl`/socket limits

Expected convention:

- local folder structure maps to Cloudinary path structure

Examples:

- `Place/California/1.jpg` → `place/california/1`
- `Place/California/San Diego/1.jpg` → `place/california/san-diego/1`

If needed, update the upload script so the new folder is included in the targeted upload flow.

Important git rule:

- do **not** add the source image folders to git
- keep source gallery assets ignored locally
- commit only the wiring: HTML, `site.js`, scripts, and docs
- deployed images should come from Cloudinary, not from committed local asset folders

---

### 9. Wire Cloudinary into the gallery config
Once uploaded:

- use `publicIdBase` or explicit `publicId`s as appropriate
- keep the local image path in place for fallback
- use the existing `resolveImageUrl(...)` pattern
- preserve `data-local-src`

This should match the current implementation style used for:

- The Natural World
- Protests
- Shapes & Shadows
- California
- San Francisco
- about portrait

---

### 10. Validate the full flow locally
After implementation, verify:

- filenames are properly normalized from `1` to `n`
- local folder references are correct
- Cloudinary upload completed for all images
- public IDs align with project naming convention
- gallery page loads
- sidebar placement is correct
- active navigation works
- lightbox works
- image fallbacks work
- no missing images or orphaned references exist

If any bad or missing image is found, remove or correct that single item cleanly.

---

### 11. Commit and push changes
Once everything is verified:

- review the changed files
- confirm that no source gallery image files are staged or committed
- create a clear git commit containing only code/config/docs changes
- push the branch to the remote repository

The work is not complete until the verified changes are committed and pushed.

---

### 12. Verify deployment with Vercel
After pushing:

- use the available signed-in Vercel setup to verify deployment
- confirm that the deployment succeeds
- check the deployed result for the new series on the primary Vercel deployment URL
- check the deployed result for the new series on the verified custom domain: `https://www.clairethomas.art`
- report both the Vercel deployment status and the custom-domain verification status back clearly

Minimum custom-domain check:

- `https://www.clairethomas.art`
- each newly added gallery page URL on that domain

If Vercel surfaces an issue, fix it and redeploy if possible.

---

## Required progress updates during execution

While doing the work, provide updates at each step, such as:

1. confirmed nav placement
2. renamed image files
3. extracted image dimensions
4. created page
5. updated `site.js`
6. updated navigation
7. uploaded only the new series to Cloudinary (parallel if appropriate; prefer `PARALLEL=2` by default)
8. validated locally
9. committed and pushed
10. verified Vercel deployment and `https://www.clairethomas.art`

Updates should be short but continuous so progress is visible.

---

## Short operating instruction

> I will provide the series name, where it should be added, and the image folder. You will rename all image files to sequential `1...n`, create the gallery page and config, add it to navigation, upload all images to Cloudinary using the local project script, wire Cloudinary delivery with local fallback, validate the result, commit and push the changes, verify deployment with Vercel, and share progress updates at each step.

---

## Copy-paste instruction block

```txt
When I provide a new series, I will only provide:
1. Series name
2. Where to add it in navigation
3. Image folder/path

For every new series:
- Share progress updates at each step.
- Rename all image files in the folder to sequential names from 1 to n, preserving extensions.
- Use that order as the canonical gallery order.
- Read all image dimensions and create the corresponding specs array in site.js.
- Create the HTML page for the series using the existing page template.
- Register the series in galleryPages.
- Add the series in portfolioLinks at the requested nav location.
- Upload only the new series images to Cloudinary using the locally available upload script/workflow.
- Prefer targeted uploads over bulk re-uploads of unrelated galleries.
- Run multiple new-series uploads in parallel when safe and supported by the script.
- Prefer `PARALLEL=2` as the default concurrency unless a higher value is known to be stable in the current environment.
- Ensure Cloudinary public IDs match the folder hierarchy convention used in the project.
- Do not commit the source gallery image files to git after upload.
- Wire the gallery to Cloudinary while preserving local fallback behavior.
- Validate page load, nav behavior, image rendering, lightbox behavior, and Cloudinary/local fallback integrity.
- Commit and push the completed changes.
- Use the available signed-in Vercel setup to verify deployment and report the result.
- Also verify the live custom domain `https://www.clairethomas.art`, including the newly added gallery page URLs.
```
