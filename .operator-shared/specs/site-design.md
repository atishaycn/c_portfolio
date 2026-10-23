# Public Site Design

Decisions the user settled during the October 2026 overhaul. Change them only on the user's request.

- Reference layout: russlevi.com/home. Header, left to right: About · Portfolio ▾ · logo · Booking · Shop.
- Portfolio menu is built from the Content's root nodes in admin `order`. Top-level albums with photos are items; a group with at least one album with photos is a small heading over those albums. The slideshow, child albums and empty albums or groups are left out. Events, Nature and Street keep `events.html`, `nature.html` and `street.html`; every other album opens at `gallery.html?album=<key>`. With no Content, the three original sections show.
- Booking order: header and intro, then an Events | Portraits switch (Events first) that shows one price group at a time, with "What's included with events" inside Events; then "Kind words", then the form. Prices live in `bookingConfig` in `site.js`.
- Homepage: slideshow from the `slideshow` album (falls back to Events). Each photo fills the full width, capped at one screen tall (trimmed top and bottom beyond that). The header stays put and the photo scrolls up over it; the footer appears only after the photo.
- Other pages: header hides as soon as the user scrolls down and returns on scroll up; it stays while the dropdown is open or focused.
- Section pages open with a full-width cover photo and the section name, without photo counts. Events uses its 2nd photo (`galleryConfig.coverIndex`). Child albums (e.g. Special occasions) appear as tabs under the parent's cover, not in the Portfolio menu. A new top-level album opens with the same section layout.
- Booking testimonials are Content (`testimonials`: ordered list of `{ id, quote, name, context, photoId }`), edited in the admin's Testimonials panel and shown in list order; `photoId` is an album photo's `id`, so reordering photos never changes the picture. Content with no list gets the three original quotes (defaults in `api/_lib/content.js`); an empty list hides "Kind words". Galleries carry no quotes (tried 2026-10-22, the user rejected it).
- Colour: logo blue-to-purple gradient (`#004aad` → `#cb6ce6`) is the accent; text is dark brown `#37170d`; header is a near-white faint gradient wash; footer is the original dark brown with white outline icons. The homepage header and footer are plain white.
- Footer icons: Email, Writing (pen, clarityincatastrophe.substack.com), Photos of the Week (Substack logo), Instagram.
- Centre content with flex/grid alignment on the full-width container, never by fixed `max-width` boxes with left-pinned margins; verify centring from 390px up to 2560px.
