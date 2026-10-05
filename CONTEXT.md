# Client intake — context

A private questionnaire Claire sends to a booked client before a shoot. The client answers questions and swipes through a deck of poses so Claire learns what kinds of photos and poses they like.

## Glossary

- **Client** — a person Claire has booked (or is about to). Created by Claire in the admin; clients never sign up.
- **Intake** — one questionnaire for one client and one shoot. Reached only through its private link.
- **Event type** — a kind of shoot (Wedding, Family, Portrait / headshot, …). Managed by Claire in the admin. Decides which poses an intake's deck starts from.
- **Pose** — one example photo the client swipes on. A pose can belong to several event types.
- **Pose source** — `own` (Claire's photo) or `reference` (someone else's work, shown to the client as "inspiration").
- **Tag group** — a scored way of describing a pose (Style, Framing, Mood, Setting, People). Each pose takes one value per group. Groups and values are editable in the admin.
- **Note tag** — a free-text tag on a pose (e.g. "golden hour"). Shown with results, never scored.
- **Deck** — the ordered poses one intake shows. Starts from the event type's poses; Claire can add or drop poses for that intake.
- **Swipe** — the client's answer on one pose: `like` (right), `dislike` (left), `must` (up / star), or `skip` (not scored).
- **Must-have** — a pose swiped `must`. Together they form the shot list Claire sees.
- **Question** — a written prompt with a kind (short text, long text, single choice, multiple choice, date/time) and a required flag. Either **shared** (every intake) or tied to one event type.
- **Intake copy** — the questions and deck frozen into an intake when Claire creates it. Template edits never change it; Claire edits it directly.
- **Intake status** — `draft` (not sent), `sent`, `started`, `submitted`, `needs update` (Claire added items after submit).
- **Leaning** — a client's score for one tag value: (2 × must + like − dislike) ÷ poses shown with that value. Shown only when at least 3 such poses were swiped.
- **Pose stats** — like / dislike / must rates for one pose across all intakes, per event type.
- **Cleanup** — deleting an intake's answers and the client's personal details while keeping its swipes as anonymous data for pose stats.
- **Intake link** — an unguessable URL (`/intake/<token>`) that Claire sends to the client. The link is the client's only credential.

## Decisions

1. **Claire sends the intake link (2026-10-04).** Claire creates the client and intake in the admin and sends the link. No client accounts, no automatic intake from the booking form. A "create intake from this inquiry" shortcut may come later.
2. **Claire manages event types in the admin (2026-10-04).** Poses link to many event types. Claire can adjust a single intake's deck. Starting types: Wedding, Engagement / couple, Family, Portrait / headshot, Birthday / celebration, Corporate event, Graduation.
3. **Poses are Claire's photos and outside references, stored in Convex (2026-10-04).** Each pose is an image in Convex file storage plus its source and tags. Pose images stay off the public Cloudinary account. Reference poses are labelled "inspiration" in the deck.
4. **Fixed tag groups drive scoring; free note tags are extra (2026-10-04).** Starting groups: Style (candid / posed), Framing (close-up / half / full body / wide), Mood (playful / romantic / calm / formal), Setting (indoor / outdoor / either), People (solo / couple / small group / large group).
5. **Swipes are like / dislike / must-have / skip, with undo (2026-10-04).** Buttons mirror every gesture. No per-card comments; one free-text box after the deck.
6. **Claire edits questions in the admin: a shared set plus extra questions per event type (2026-10-04).** One-off questions happen only by editing a single intake's copy (see 7). Seed shared set: who is in the shoot, schedule for the day, must-know people, anything to avoid, accessibility needs, comfort in front of the camera.
7. **Each intake keeps its own copy of questions and deck, which Claire can edit at any time, even after sending (2026-10-04).** Template edits only affect new intakes. Claire can edit, add, or remove questions and poses on one intake, or refresh it from the current templates. Poses in use are archived, not deleted.
8. **Edits after the client starts never lose answers (2026-10-04).** Reworded questions keep their answer, flagged "answered under earlier wording". Removed questions or poses hide from the client but their answers stay in Claire's results. Items added after submit reopen the intake: the client sees only the new items, marked "New from Claire", and the intake shows `needs update`. Claire chooses whether the site emails the client about it.
9. **Results are a per-client summary plus cross-client pose stats; no adaptive deck (2026-10-04).** Per intake: must-have shot list, leanings per tag group, written answers, note tags of liked poses. Across intakes: pose stats so Claire can prune decks. Every client of an event type sees the same deck order.
10. **Browsers never call Convex; Vercel functions do, with a shared secret (2026-10-04).** See `docs/adr/0001-convex-behind-vercel-functions.md`.
11. **Intake links expire 30 days after the shoot date and can be revoked or reissued (2026-10-04).** Token: 32 random bytes, stored only as a hash; issuing a new link kills the old one. Intake page is `noindex`, `no-referrer`, rate-limited per IP. Clients can change their answers until the link closes.
12. **Client flow: welcome → deck → "anything else about the poses?" → questions → review → submit (2026-10-04).** Every answer and swipe saves immediately; the link resumes where the client left off. Phone-first, with a progress bar. Submit needs all required questions answered and every card swiped (skip counts).
13. **Emails via the existing Resend setup (2026-10-04).** Claire is emailed when a client submits or resubmits. Client emails (the link, "added a few things") go only when Claire presses "Send by email", with an editable default message. "Copy link" is always available.
14. **Separate admin page `intake-admin.html`, same login (2026-10-04).** Tabs: Intakes, Poses, Questions, Event types. Pose images are served through `/api` so the page CSP stays `'self'`.
15. **Convex prod deploys in the Vercel production build; previews and local use Convex dev (2026-10-04).** See `docs/adr/0002-convex-deploys-with-vercel-build.md`.
16. **Answers are kept until Claire cleans them up, with a prompt 12 months after the shoot (2026-10-04).** Cleanup keeps swipes anonymously. The intake page states what is collected and why; its wording must not promise automatic deletion.
17. **Decks hold up to 40 cards by default (set per event type), ordered by Claire's rank and spread so no tag value appears more than twice in a row (2026-10-04).** The order is fixed into the intake copy at creation.
18. **Pose images are resized in the browser and streamed through `/api` (2026-10-04).** The admin page resizes to 1600 px WebP and strips metadata before posting to a Vercel function, staying under the 4.5 MB body limit. Clients see images via `/api/intake/<token>/pose/<id>`, which checks the token and streams from Convex with `Cache-Control: private`. Convex storage URLs are never exposed.
19. **Release cut (2026-10-04).** v1: Convex schema and seed data; `intake-admin.html` for event types, questions, poses, creating, linking, revoking and editing intakes; the client page (welcome → deck → questions → review → submit, saved as it goes); per-client results; email to Claire on submit. v2: "Send by email" and "added a few things" client emails, pose stats, cleanup prompt and button, intake from a booking inquiry. The client page matches the site's existing fonts and colours. Prototype the swipe screen before building it.
