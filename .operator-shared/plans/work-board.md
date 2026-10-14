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
| Shop store (Pixieset-style) | `ui/shop-store` | `~/Developer/c_portfolio-shop-store` | Accepted state: `3d45cf7`, pushed, worktree clean. The store sells the generated Gelato catalog (10 products, 267 variants); cart works; checkout still shows "coming soon". Spec: `specs/shop-store.md`. Full state: "Shop store: state at hand-off" below. | Build cart checkout on the Print Store Stripe sandbox (reuse the checks from `shop/stripe-print-pilot`), then send paid orders to Gelato. | Local only. User approves before it replaces "Coming soon" on production. Waiting on the user for the sandbox secret key and on Claire for prices. Deleting Gelato products needs the user to confirm the exact list. |
| Stripe print pilot | `shop/stripe-print-pilot` | `~/Developer/c_portfolio-stripe-shop` | Test-mode checkout for one print (Nature #10, 12×16, $40 placeholder); webhook verifies payment; nothing sent to Gelato. Disabled on production in code. | User adds a Stripe test key and runs `stripe listen`; one local test purchase. | Built on old `main` (`fb1ac28`): rebase before more work. Decide how it coexists with the live Shopify shop. |

## Shop store: state at hand-off (2026-10-13)

The fork thread that did this work handed it back to the CEO thread. Decisions (user, 2026-10-13): Gelato is the only lab; the Shopify shop closes at release; payments go to a new Stripe account.

### Done and verified

- `scripts/shop-catalog.mjs` writes `content/shop-catalog.json` from the Gelato product API (`12b4ac6`). Every product ID, status, orientation and price was checked against a separate dump (`~/Developer/.shop-preview/gelato-reference/products-2026-10-13.json`); a second run gave the same file.
- Store rebuilt on that file (`2f7f7e0`), then three defects fixed (`3d45cf7`): Wood Frame moulding follows the frame colour, frame side face hidden in the front view, chosen options show their catalog label.
- Checked at `3d45cf7`: `npm run check` 128 pass; home and all 10 product pages at 1280px and 390px with 0 errors, 0 broken images, no sideways scroll; Print 11 x 14 Archival matte through picker, customize and cart shows $23, the catalog price.

### Steps left, in order

1. Cart checkout through Stripe in test mode: prices computed on the server from the catalog file, plus the print-file and webhook checks from `shop/stripe-print-pilot` (that branch is on old `main` `fb1ac28`; copy the logic, do not merge it).
2. Paid order goes to Gelato (order API, `orderType` draft first) and to Claire; customer gets a confirmation.
3. Shipping, tax and returns policy. The cart now says "Shipping and taxes are confirmed by email."
4. One real paid order, then release on user approval.
5. At release, close Shopify: repoint the lightbox "Order print" link, cancel the Shopify plan, remove the `shop.` DNS record, delete the 48 Gelato store products and 4 templates, remove the sync workflow, `api/admin/shop-sync.js` and the sync scripts.

### Open items

- Photo size check is not built: the store offers every size for every photo. The spec requires a size only when the original has enough pixels; the pixel threshold is not decided.
- The photo picker flickers when it redraws.
- Retail prices are Gelato US cost x 2.5, a sample until Claire sets prices.
- A Codex child saw one Cloudinary 404 (`place/california/san-francisco/83`) on a single load. That photo is not in the live content and no sweep reproduced it.
- `README.md` and `program.md` do not describe the store. The codebase index on `main` lists no store files; index them when the branch merges.

### Stripe

- Account: "Print Store" `acct_1UQHdCJ0O7SZaOmQ`, in a new organization under Claire's login. Not activated (`charges_enabled` false). Its statement name was copied as `BUYMEACOFFEE.COM`; change it before real sales.
- CLI: `~/.local/bin/stripe` 1.53.1 on `servesunny`, paired by browser approval. Config `~/.config/stripe/config.toml`, credentials `~/.config/stripe/credentials.json` (unencrypted, mode 600; the server has no keyring). Active context: Print Store sandbox. It can create test checkout sessions. The access token is short-lived and refreshes itself; if a call fails with an auth error, run `stripe login --non-interactive`, give the user the link, then `stripe login --complete-reauth`.
- Webhook secret: stored nowhere. `stripe listen --print-secret` prints it; `stripe listen --forward-to <local url>` forwards events.
- Buymeacoffee access NOT removed: at the last approval the CLI was still authorized for "Buymeacoffee" (`acct_1TnNSUJAb1tywB97`) live and sandbox. Nothing was run in its live mode. The user removes it on the CLI approval page. Until then, never pass `--live` and check the "Running in" line of every CLI call.
- The user still has to: (1) remove the Buymeacoffee access; (2) put the Print Store sandbox secret key in `~/Developer/c_portfolio-shop-store/.env.stripe.local` as `STRIPE_SECRET_KEY=` (git-ignored; the file does not exist yet; the exact hidden-input command was given in the fork thread); (3) before real sales, activate the account and fix the statement name.

### Processes and local files

- tmux session `shop-preview`: preview server on `127.0.0.1:8095` and `100.87.15.27:8095`, serving `~/Developer/c_portfolio-shop-store`. Stop with `tmux kill-session -t shop-preview`.
- Nothing else is running: no `stripe listen`, no `stripe login` poll, no child task.
- Outside the repo, in `~/Developer/.shop-preview/`: `server.mjs` (preview server), `gelato-reference/` (product dump), `round2/` (16 Wood Frame screenshots). `/tmp/gelato-audit/` holds the read-only audit scripts and may be gone after a reboot.
- `~/Developer/c_portfolio-shop-store/.env.gelato.local` is a copy of the one in `~/Developer/c_portfolio` (git-ignored).

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
