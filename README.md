# cportfolio

Static portfolio site with placeholder content for safe editing and later content replacement.

Uses local images by default, with Cloudinary delivery currently enabled for `The Natural World`, `Protests`, `Shapes & Shadows`, the about portrait, and now preconfigured public IDs for `California` and `San Francisco`, plus local fallback for everything else.

The portfolio sidebar now includes a collapsible `place` section with `California` and `San Francisco` sub-galleries. The UI is wired to `./Place/California/` and `./Place/California/San Francisco/`, and both galleries are populated with local images.

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
- `california.html`
- `san-francisco.html`

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
- `California` uses Cloudinary public IDs in the `place/california/...` path with local fallback
- `San Francisco` uses Cloudinary public IDs in the `place/california/san-francisco/...` path with local fallback
- other images still use local files
- gallery images and the lightbox fall back to local files if a Cloudinary asset fails to load

To upload the `Place` galleries to Cloudinary with the paths already wired in `site.js`:

```bash
cp .env.example .env
# fill in your Cloudinary values, or set CLOUDINARY_URL directly
./scripts/upload-place-to-cloudinary.sh
```

The upload script automatically loads `.env` if present. Supported variables:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_URL`

This uploads:
- `Place/California/<n>.jpg` -> `place/california/<n>`
- `Place/California/San Francisco/<n>.jpg` -> `place/california/san-francisco/<n>`

To move more series to Cloudinary:
1. Upload the images to Cloudinary
2. Fetch or copy their public IDs
3. Add those public IDs to the relevant items in `site.js`
4. Refresh the site
