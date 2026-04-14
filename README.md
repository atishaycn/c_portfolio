# cportfolio

Static portfolio site with placeholder content for safe editing and later content replacement.

Uses local images by default, with Cloudinary delivery currently enabled for `The Natural World`, `Protests`, `Shapes & Shadows`, and the about portrait, plus local fallback for everything else.

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

Cloudinary is configured in `site.js` with:
- cloud name: `dpmdkrggj`
- transformations: `f_auto,q_auto`

Current behavior:
- `The Natural World` uses explicit Cloudinary public IDs
- `Protests` uses Cloudinary public IDs in the `protests/...` path
- `Shapes & Shadows` uses Cloudinary public IDs in the `shapes-and-shadows/...` path
- the about portrait uses Cloudinary public ID `about/portrait`
- other images still use local files
- gallery images and the lightbox fall back to local files if a Cloudinary asset fails to load

To move more series to Cloudinary:
1. Upload the images to Cloudinary
2. Fetch or copy their public IDs
3. Add those public IDs to the relevant items in `site.js`
4. Refresh the site
