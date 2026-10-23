# Public Site Design

Decisions the user settled during the October 2026 overhaul. Change them only on the user's request.

- Reference layout: russlevi.com/home. Header, left to right: About · Portfolio ▾ · logo · Booking · Shop.
- Portfolio menu is built from the Content's root nodes in admin `order`. Top-level albums with photos are items; a group with at least one album with photos is a small heading over those albums. The slideshow, child albums and empty albums or groups are left out. Events, Nature and Street keep `events.html`, `nature.html` and `street.html`; every other album opens at `gallery.html?album=<key>`. With no Content, the three original sections show.
- Booking order: header and intro, then an Events | Portraits switch (Events first) that shows one price group at a time, with "What's included with events" inside Events; then "Kind words", then the form. Prices and testimonials live in `bookingConfig` in `site.js`.
- Homepage: slideshow from the `slideshow` album (falls back to Events). Each photo fills the full width, capped at one screen tall (trimmed top and bottom beyond that). The header stays put and the photo scrolls up over it; the footer appears only after the photo.
- Other pages: header hides as soon as the user scrolls down and returns on scroll up; it stays while the dropdown is open or focused.
- Section pages open with a full-width cover photo and the section name, without photo counts. Events uses its 2nd photo (`galleryConfig.coverIndex`). Child albums (e.g. Special occasions) appear as tabs under the parent's cover, not in the Portfolio menu. A new top-level album opens with the same section layout.
- Gallery quotes: a client quote belongs to a photo (`quote` on the Content item) and shows right after it, centred across both grid columns, never on the cover photo, and not in the lightbox. Claire adds and edits them in the admin under each photo ("Quote after this photo"). Booking testimonials stay in `bookingConfig`.
- Colour: logo blue-to-purple gradient (`#004aad` → `#cb6ce6`) is the accent; text is dark brown `#37170d`; header is a near-white faint gradient wash; footer is the original dark brown with white outline icons. The homepage header and footer are plain white.
- Footer icons: Email, Writing (pen, clarityincatastrophe.substack.com), Photos of the Week (Substack logo), Instagram.
- Centre content with flex/grid alignment on the full-width container, never by fixed `max-width` boxes with left-pinned margins; verify centring from 390px up to 2560px.
