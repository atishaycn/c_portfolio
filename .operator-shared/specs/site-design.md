# Public Site Design

Decisions the user settled during the October 2026 overhaul. Change them only on the user's request.

- Reference layout: russlevi.com/home. Header, left to right: About · Portfolio ▾ (Events, Nature, Street) · logo · Booking · Shop.
- Homepage: slideshow from the `slideshow` album (falls back to Events). Each photo fills the full width, capped at one screen tall (trimmed top and bottom beyond that). The header stays put and the photo scrolls up over it; the footer appears only after the photo.
- Other pages: header hides as soon as the user scrolls down and returns on scroll up; it stays while the dropdown is open or focused.
- Section pages open with a full-width cover photo and the section name, without photo counts. Events uses its 2nd photo (`galleryConfig.coverIndex`). Child albums (e.g. Special occasions) appear as tabs under the parent's cover, not in the Portfolio menu.
- Colour: logo blue-to-purple gradient (`#004aad` → `#cb6ce6`) is the accent; text is dark brown `#37170d`; header is a near-white faint gradient wash; footer is the original dark brown with white outline icons. The homepage header and footer are plain white.
- Footer icons: Email, Writing (pen, clarityincatastrophe.substack.com), Photos of the Week (Substack logo), Instagram.
