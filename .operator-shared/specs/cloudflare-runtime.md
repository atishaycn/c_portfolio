# Cloudflare Workers runtime rules

The site runs on Cloudflare Workers **Free** (user decision, 2026-10-14; plan: `plans/cloudflare-migration.md`). Every `api/` function must work inside these limits.

## Limits per request

- 10 ms CPU. An isolate tolerates an occasional overrun; a Worker that overruns again and again fails with error 1102.
- 50 subrequests (outgoing `fetch` calls).
- 1 s to run the Worker's top-level code at startup.

## Rules

- Measure CPU on the real `workers.dev` deployment (`wrangler tail --format json`, field `cpuTime`). Local `wrangler dev` profiles count network waiting as CPU and are not a guide.
- No heavy SDK in a function. Stripe goes through `api/_lib/stripe.js`: the stripe SDK cost 7–16 ms CPU per call on Workers, a plain `fetch` about 1 ms. A new Stripe call adds a method there with the SDK's name and shape.
- Never call `fetch` as a method of another object (`deps.fetch(url)`): Workers throws "Illegal invocation". Pass `(...args) => fetch(...args)`.
- Every per-item outgoing call has a cap that keeps the request under 50 subrequests: a cart has at most 20 lines; the Orders list reads the 40 latest completed sessions and skips Gelato for cancelled and approved orders.
- `VERCEL_ENV` does not exist on Cloudflare. Until release, the Shop's test guards rest on the `sk_test_` key and `SHOP_CHECKOUT_ENABLED`.

## Measured (2026-10-14, after the Stripe client)

Warm requests: content 1–4 ms, catalog 4–10, buyer's order view 4–9, Orders list 5–14, checkout 5–17 (median about 10). No request failed. Checkout and the Orders list sit near the limit: measure again after any change to them.
