# Work Board

Last updated: 2026-10-13. The CEO thread keeps this current. Every row's code is committed and pushed on its branch.

## Production

- `main` is live (site code unchanged since `bbd6d6a`) on clairethomas.art: new top-nav design, slideshow homepage, section cover pages, Booking page with packages and the Resend inquiry form, Empty Trash in admin.

## Checkouts

- `~/Developer/c_portfolio-main` — clean `main` checkout for brain edits and releases. Merge `main` into a workstream branch to give it the latest brain.
- The project moved from the Mac to `servesunny` on 2026-10-11. Worktrees that exist there: `c_portfolio` (`drive/album-folders`), `c_portfolio-main`, `c_portfolio-shop-store`. Create the others from their branches when a workstream resumes.

## Open workstreams

| Workstream | Branch | Worktree | Status | Next step | Gate |
|---|---|---|---|---|---|
| Drive per-album folders | `drive/album-folders` | `~/Developer/c_portfolio` | Nature served from a Drive folder (test, not live). OAuth sign-in done; read-only dry run matched 100 of 141 live photos byte-for-byte, 4 visual candidates, 37 not in Drive. Runbook: `DRIVE_MIGRATION.md` on the branch. | Create `Website/{Events/Special occasions,Nature,Street,Slideshow}` with 100 shortcuts + 41 uploads from the Cloudinary backup; preserve IDs, order and 26 print settings. | User approval before any Drive write. Decide whether Drive replaces Cloudinary for serving or only as source of truth (speed risk). |
| Client intake (pose swipe) | `feature/client-intake` | `~/Developer/c_portfolio-client-intake` | v1 built: Convex backend, client swipe page, `intake-admin.html`. Preview build passes, 132 tests. Design in `CONTEXT.md` + `docs/adr/` on the branch. Prod secrets set. | Configure admin login for Preview; Claire replaces the 16 sample poses with real ones; then merge to `main` (deploys site + Convex prod). | User approval to merge. Rebase on `main` first. |
| Shop store (Pixieset-style) | `ui/shop-store` | `~/Developer/c_portfolio-shop-store` | Spec: `specs/shop-store.md`. Phase 1 done and verified (`ae2c896`): catalog, 3D CSS mockups with 4 views, store home, product page. Phase 2 done and verified: photo picker, customize with live mockup and edit panel, wall preview, localStorage cart, checkout "coming soon". User saw the local preview on 2026-10-13 and approved the look. Local preview: `node ~/Developer/.shop-preview/server.mjs <checkout> 8095 [host ...]` (proxies live content read-only, refuses writes; outside the repo; runs in tmux session `shop-preview`). The Pixieset reference captures stayed on the Mac. | End to end, in order: (1) generate the catalog file from the Gelato product API (US sizes, product UIDs, costs) — Codex child started 2026-10-13, work uncommitted in the worktree until the CEO verifies it; a dump of the Gelato product lists is at `~/Developer/.shop-preview/gelato-reference/`; (2) rebuild the store catalog on it (10 products, see the spec's Gelato mapping); (3) cart checkout through Stripe in test mode, prices computed on the server, reusing the pilot's print-file and webhook checks; (4) paid order goes to Gelato and to Claire, customer gets a confirmation; (5) shipping, tax and returns policy; (6) polish: frame side face looks detached in front view, picker redraw makes images flicker; (7) one real paid order, then release; (8) at release, close Shopify: repoint "Order print", cancel the Shopify plan, remove the `shop.` DNS record, delete the 48 Gelato store products and 4 templates, remove the sync workflow, `api/admin/shop-sync.js` and the sync scripts. | Local only. User approves before it replaces "Coming soon" on production. Prices are samples until Claire sets them. Decided 2026-10-13: Gelato only, Shopify closes at release. Waiting on: Stripe keys from the user; Claire's markup or prices. Deleting Gelato products needs the user to confirm the exact list. |
| Stripe print pilot | `shop/stripe-print-pilot` | `~/Developer/c_portfolio-stripe-shop` | Test-mode checkout for one print (Nature #10, 12×16, $40 placeholder); webhook verifies payment; nothing sent to Gelato. Disabled on production in code. | User adds a Stripe test key and runs `stripe listen`; one local test purchase. | Built on old `main` (`fb1ac28`): rebase before more work. Decide how it coexists with the live Shopify shop. |

## Loose ends (no branch yet)

1. Rotate the admin password and session secret; delete the three deployments that served the credentials file (`specs/release-and-security.md`). Needs user go-ahead.
2. Send one real test inquiry from the live Booking page and confirm it arrives at `contact@` with a working Reply-To.
3. Booking testimonials: waiting on real quotes and photos from Claire.
4. Orphaned album pages (`california`, `san-francisco`, `india`, `commissioned-work`) still render Nature photos. User deferred cleanup.
5. `README.md` and `program.md` describe the pre-overhaul site; refresh or fold into this brain.
6. Shop is "Coming soon" (header Shop → `prints.html`, since 2026-10-06), but the "Order print" links on photos with prints switched on still open the Shopify store. Decide whether to hide them until the shop opens.
7. Fold the useful parts of `APP_OPERATIONS.md` / `APP_REFERENCE.md` (only on `work/local-changes-handoff`) into the brain, then retire that branch.

## Archived branches (kept for reference, do not build on)

- `work/local-changes-handoff` — 2026-10-02 snapshot of the old dirty checkout: per-photo Drive mapping (superseded by `drive/album-folders`), shop review docs, `APP_*.md`.
- `codex/save-local-changes-20260427` (remote only) — April 2026 snapshot.
