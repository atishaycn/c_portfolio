# cportfolio

Static portfolio site with placeholder content for safe editing and later content replacement.

Uses local images by default, with optional Cloudinary delivery support for all portfolio images and the about portrait.

## Files

- `index.html`
- `street-abstractions.html`
- `multiple-exposures.html`
- `music.html`
- `nyc.html`
- `out-of-town.html`
- `bts.html`
- `self-reflections.html`
- `workshops.html`
- `about-contact.html`
- `styles.css`
- `site.js`

## Run locally

Open any html file in browser.

Or serve folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Cloudinary setup

The site is ready to switch from local files to Cloudinary URLs.

1. Upload your images to Cloudinary under a single base folder, for example:
   - `claire-thomas-portfolio/The Natural World/1.jpg`
   - `claire-thomas-portfolio/Protests/1.JPG`
   - `claire-thomas-portfolio/Shapes & Shadows/1.JPG`
   - `claire-thomas-portfolio/PHOTO-2025-12-19-16-40-24.jpg`
2. Open `site.js` and update `cloudinaryConfig`:
   - `enabled: true`
   - `cloudName: "<your cloud name>"`
   - optionally change `baseFolder`
3. Refresh the site.

Cloudinary URLs are generated automatically with `f_auto,q_auto` so optimized assets are delivered without changing the HTML files.
