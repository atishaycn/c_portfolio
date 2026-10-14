# Plan: move the whole site from Vercel to Cloudflare (free plan)

Decided by the user on 2026-10-14: the whole site leaves Vercel (Hobby is non-commercial and the user will not pay for Pro) and runs on Cloudflare Workers **Free**, with no paid plan. Background and costs: `research/hosting-and-images.md`. Everything else (Cloudinary, Stripe, Gelato, Resend) stays.

Branch `infra/cloudflare`, cut from `ui/shop-store`, worktree `~/Developer/c_portfolio-cloudflare`. The Shop and the move release together.

## Constraints

- Workers Free: 100,000 requests a day; 10 ms CPU per request, and a request over it fails (error 1102). Static assets are free and do not count. Every function must fit, measured on a real deployment, not assumed.
- Known risk: the admin login's scrypt password check. Fallbacks, in order: a cheaper hash measured under the limit; Cloudflare Access in front of the admin.
- No DNS change until the site works end to end on the `workers.dev` address with the Stripe sandbox.
- The domain's DNS moves from Namecheap to Cloudflare (a custom domain needs Cloudflare DNS). `contact@` forwarding is Namecheap's and stops working there; rebuild it with Cloudflare Email Routing and test mail before and after the switch. Copy every record (Resend, `shop.` for Shopify until it closes, any verification records).

## Steps

1. Worker entry and adapter: one Worker serves the static site from a built assets folder and runs the existing `api/` handlers through an adapter from Fetch `Request`/`Response` to the Node-style `(req, res)` they use. Security headers move from `vercel.json` to `_headers`. Local run with `wrangler dev`.
2. Runtime fixes: Stripe webhook signature check made async; anything else that fails in Workers.
3. Deploy to `workers.dev` with the user's Cloudflare API token (git-ignored), sandbox Stripe and test webhook; run the full Shop and admin checks; record CPU time per endpoint and fix any over 10 ms.
4. DNS cutover (user approval): Cloudflare zone, records copied, Email Routing for `contact@`, nameservers changed at Namecheap, custom domain on the Worker, mail and site checked. Then the Vercel project is disconnected.
5. Other branches with functions (`drive/album-folders`, `feature/client-intake`) get the same adapter when they merge.
