# Plan: move the whole site from Vercel to Cloudflare (free plan)

Decided by the user on 2026-10-14: the whole site leaves Vercel (Hobby is non-commercial and the user will not pay for Pro) and runs on Cloudflare Workers **Free**, with no paid plan. Background and costs: `research/hosting-and-images.md`. Everything else (Cloudinary, Stripe, Gelato, Resend) stays.

Branch `infra/cloudflare`, cut from `ui/shop-store`, worktree `~/Developer/c_portfolio-cloudflare`. The Shop and the move release together.

## Constraints

- Workers Free: 100,000 requests a day; 10 ms CPU per request, and a request over it fails (error 1102). Static assets are free and do not count. Every function must fit, measured on a real deployment, not assumed.
- The admin login's scrypt check (~45 ms) is replaced by an email sign-in link (user decision, 2026-10-14; `specs/release-and-security.md`), built on `infra/cloudflare` (`5f56c4b`, hardened in the next commit) and checked on `wrangler dev`.
- No DNS change until the site works end to end on the `workers.dev` address with the Stripe sandbox.
- The domain's DNS moves from Namecheap to Cloudflare (a custom domain needs Cloudflare DNS). `contact@` forwarding is Namecheap's and stops working there; rebuild it with Cloudflare Email Routing and test mail before and after the switch. Copy every record (Resend, `shop.` for Shopify until it closes, any verification records).

## Steps

1. (Done `e7b641e`: 236 tests; `wrangler dev` smoke test passed; `/` maps to `index.html`, `_redirects` from `vercel.json`; `/api/*` default headers set in the Worker because `_headers` does not apply to Worker responses.) Worker entry and adapter: one Worker serves the static site from a built assets folder and runs the existing `api/` handlers through an adapter from Fetch `Request`/`Response` to the Node-style `(req, res)` they use. Security headers move from `vercel.json` to `_headers`. Local run with `wrangler dev`.
2. (Done.) Runtime fixes: async webhook signature check (`e7b641e`); unbound `fetch` for Gelato calls (`71255f4`); Orders list capped under 50 subrequests (`533705c`); Stripe SDK replaced by a fetch client to cut CPU (`19b711d`). Rules: `specs/cloudflare-runtime.md`.
3. (Done 2026-10-14, except sign-in email.) Live at `https://clairethomas-site.phunnysunny.workers.dev` with sandbox Stripe; secrets set with `wrangler secret bulk`; a new `ADMIN_SESSION_SECRET` for this address is kept in the worktree's git-ignored `.env.workers-dev.local`. Test webhook: `stripe listen` (tmux `stripe-cf`) forwards to the Worker. Checked: store, cart, Stripe Tax ($1.47 on $17 + $8 shipping in SF), paid order → one Gelato draft, buyer's confirmation page, Orders tab on a 390 px screen, sign-in link redeem, Cancel (one refund, draft deleted). CPU: `specs/cloudflare-runtime.md`.
   - Open: no `RESEND_API_KEY` exists outside Vercel (Vercel keeps it write-only), so sign-in emails and order emails are not sent from the Worker yet. The user creates a new Resend key; it goes in with `wrangler secret put`, then one sign-in email is tested.
4. DNS cutover (user approval): Cloudflare zone, records copied, Email Routing for `contact@`, nameservers changed at Namecheap, custom domain on the Worker, mail and site checked. Then the Vercel project is disconnected.
5. Other branches with functions (`drive/album-folders`, `feature/client-intake`) get the same adapter when they merge.
