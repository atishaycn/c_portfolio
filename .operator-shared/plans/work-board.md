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
| Shop store (Pixieset-style) | `ui/shop-store` | `~/Developer/c_portfolio-shop-store` | Branch head `fb61b91`, pushed, worktree clean. Catalog, cart, Stripe test checkout, webhook and Gelato draft order all work end to end (2026-10-14). The user's five decisions (2026-10-14) are in the specs; Stripe Tax, the returns note and the draft-approval email line are built and passed a sandbox purchase (Print 8 x 10 to San Francisco: $17 + $8 shipping + $1.47 tax = $26.47; draft created, then deleted). Admin (2026-10-14, `specs/shop-admin.md`): Shop settings panel and Orders tab built and checked with sandbox orders (test Approve leaves the Gelato draft untouched; Cancel deleted drafts and refunded each payment once). Edit (crop and same-price options) built and checked: a Wood Frame order edited from black to natural wood left one new Gelato draft, and the buyer page showed the change at the same price. Known edit limits: if Stripe's metadata update fails after the draft swap, the order shows Needs attention. Spec: `specs/shop-store.md`. Full state: "Shop store: state at hand-off" below. | Release (needs user approval): Claire's Stripe Tax setup, Gelato resale certificate and account activation; Vercel env; live webhook; guard removal; check `/api/_lib/shop-costs.json` is not served; order-email test; merge. | Local only. User approves before it replaces "Coming soon" on production. Waiting on Claire for prices. Deleting Gelato products needs the user to confirm the exact list. |
| Stripe print pilot | `shop/stripe-print-pilot` | `~/Developer/c_portfolio-stripe-shop` | Test-mode checkout for one print (Nature #10, 12×16, $40 placeholder); webhook verifies payment; nothing sent to Gelato. Disabled on production in code. | User adds a Stripe test key and runs `stripe listen`; one local test purchase. | Built on old `main` (`fb1ac28`): rebase before more work. Decide how it coexists with the live Shopify shop. |

## Shop store: state at hand-off (2026-10-13)

The fork thread that did this work handed it back to the CEO thread, which owns all work again; the fork is settled. Checkout contract: `specs/shop-checkout.md`. Decisions (user, 2026-10-13): Gelato is the only lab; the Shopify shop closes at release; payments go to a new Stripe account.

### Done and verified

- `scripts/shop-catalog.mjs` writes `content/shop-catalog.json` from the Gelato product API (`12b4ac6`). Every product ID, status, orientation and price was checked against a separate dump (`~/Developer/.shop-preview/gelato-reference/products-2026-10-13.json`); a second run gave the same file.
- Store rebuilt on that file (`2f7f7e0`), then three defects fixed (`3d45cf7`): Wood Frame moulding follows the frame colour, frame side face hidden in the front view, chosen options show their catalog label.
- Checked at `3d45cf7`: `npm run check` 128 pass; home and all 10 product pages at 1280px and 390px with 0 errors, 0 broken images, no sideways scroll; Print 11 x 14 Archival matte through picker, customize and cart shows $23, the catalog price.

### Steps left, in order

1. (Slice 1a, server side, done and verified 2026-10-13, `ce39af2`: 160 tests pass; a three-line cart priced at catalog prices; the cropped full-size print file loads from Cloudinary; the Stripe sandbox accepted the exact request, total $275.00, and the session was expired. Slice 1b done and verified 2026-10-13, `c710380`: 163 tests pass; on the real page a Wood Frame order reached the cart at the catalog price, Checkout showed the server's answer, the cancelled and not-confirmed return pages keep the cart, and 4 of 26 photos are refused for 30 x 40; clean at 1280px and 390px. The paid confirmation screen is not seen yet: it needs the Stripe key. Each cart line now holds its own size. tmux session `shop-dev` runs `npm run dev:shop` on `127.0.0.1:8096`. Slice 2 (webhook, Gelato draft order, email to Claire) done with fakes, `7bb6826`: 188 tests pass; CEO review fixed one defect (a paid order whose product or photo is gone now emails Claire instead of being retried and lost). End-to-end test passed 2026-10-14: Canvas 8 x 10 slim, $37 + $20 shipping, paid with 4242 in the sandbox; the return page said "Your order is confirmed" and emptied the cart; the webhook answered 200 and created Gelato draft `ae20f79f-eea1-4b3d-bd83-32a64f168303` (reference = session ID, 4860 x 3888 print file, Gelato cost $14.59); a resent event created nothing new. The order email was not tested (no `RESEND_API_KEY` locally). The user checked the canvas sides on the draft; the draft was then deleted (Gelato holds 0 orders). To rerun: `.env.stripe.local` holds both keys; tmux `shop-dev` and `stripe-listen` (`stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to http://127.0.0.1:8096/api/stripe-webhook`; it needs `--events`). `.vercelignore` does not allow `package-lock.json` yet; add it at release.) Cart checkout through Stripe in test mode: prices computed on the server from the catalog file, plus the print-file and webhook checks from `shop/stripe-print-pilot` (that branch is on old `main` `fb1ac28`; copy the logic, do not merge it).
2. Paid order goes to Gelato (order API, `orderType` draft first) and to Claire; customer gets a confirmation.
3. Shipping, tax and returns policy. The cart now says "Shipping and taxes are confirmed by email."
4. One real paid order, then release on user approval.
5. At release, close Shopify: repoint the lightbox "Order print" link, cancel the Shopify plan, remove the `shop.` DNS record, delete the 48 Gelato store products and 4 templates, remove the sync workflow, `api/admin/shop-sync.js` and the sync scripts.

### Open items

- Photo size check: built (`c710380`), 125 px per inch; see `specs/shop-checkout.md`.
- Photo picker flicker: fixed `6ee87ed` (thumbnails stay the same nodes on select).
- Retail prices are Gelato US cost x 2.5, a sample until Claire sets prices.
- A Codex child saw one Cloudinary 404 (`place/california/san-francisco/83`) on a single load. That photo is not in the live content and no sweep reproduced it.
- `README.md` and `program.md` do not describe the store. The codebase index on `main` lists no store files; index them when the branch merges.

### Stripe

- Account: "Print Store" `acct_1UQHdCJ0O7SZaOmQ`, in a new organization under Claire's login. Not activated (`charges_enabled` false). Its statement name was copied as `BUYMEACOFFEE.COM`; change it before real sales.
- CLI: `~/.local/bin/stripe` 1.53.1 on `servesunny`, paired by browser approval. Config `~/.config/stripe/config.toml`, credentials `~/.config/stripe/credentials.json` (unencrypted, mode 600; the server has no keyring). Active context: Print Store sandbox. It can create test checkout sessions. The access token is short-lived and refreshes itself; if a call fails with an auth error, run `stripe login --non-interactive`, give the user the link, then `stripe login --complete-reauth`.
- Webhook secret: stored nowhere. `stripe listen --print-secret` prints it; `stripe listen --forward-to <local url>` forwards events.
- Buymeacoffee access removed 2026-10-14: a fresh CLI grant covers only Print Store (`acct_1UQHdCJ0O7SZaOmQ`) and its sandbox `acct_1UQHdkQvRjzFGXTO`; `stripe switch` to Buymeacoffee fails. Never run CLI or API calls against Buymeacoffee.
- The user still has to: (1) done 2026-10-14: Buymeacoffee access removed; (2) done 2026-10-14: the sandbox secret key and the `stripe listen` webhook secret are in `~/Developer/c_portfolio-shop-store/.env.stripe.local` (git-ignored); (3) before real sales, activate the account and fix the statement name.

### Processes and local files

- tmux session `shop-preview`: preview server on `127.0.0.1:8095` and `100.87.15.27:8095`, serving `~/Developer/c_portfolio-shop-store`. Stop with `tmux kill-session -t shop-preview`.
- tmux `shop-dev` (`npm run dev:shop`, `127.0.0.1:8096`) and `stripe-listen` (forwards sandbox webhooks to it). Logs in `~/Developer/.shop-preview/`. No child task.
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
