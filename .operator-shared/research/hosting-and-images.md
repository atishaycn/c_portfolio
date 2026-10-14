# Hosting and image delivery: Vercel and Cloudinary vs Cloudflare

Last Updated: 2026-10-14. Prices from the vendors' pages (sources at the end); Cloudinary usage read from its Usage API that day.

## Current state

- Hosting: Vercel, with the site's API as Vercel Node functions (`(req, res)` handlers). The Vercel plan is not recorded; Hobby is non-commercial only, so selling prints needs Pro ($20/mo).
- Images and CMS content: Cloudinary Free. On 2026-10-14: 6.8 of 25 credits (27%) — 2.6 GB stored, 2.8 GB delivered a month, about 1,900 transformations, 523 assets.

## Moving hosting to Cloudflare

- Run cost: Workers Paid, $5/mo minimum (10M requests, 30M CPU-ms included; static assets free and unlimited). Workers Free is too tight: 10 ms CPU per request, and the admin login's scrypt check alone exceeds it. Saving against Vercel Pro: $15/mo, $180/yr.
- Code: `node:crypto` (scrypt, HMAC, timingSafeEqual) is supported with `nodejs_compat`. Every function needs an adapter from Vercel's `(req, res)` to Fetch `Request`/`Response`; the Stripe webhook needs the raw body and async signature check; `vercel.json` headers become a `_headers` file; the `.vercelignore` allowlist becomes a built assets folder.
- DNS: the domain moves to Cloudflare DNS. `contact@` forwarding is Namecheap's and only works on Namecheap DNS, so it must be rebuilt with Cloudflare Email Routing (free), and Resend's records re-created. This is the main risk.
- Effort: about 2–4 agent days plus a careful DNS cutover.

## Replacing Cloudinary

- Cloudflare R2 (10 GB free storage, no egress fees) plus Cloudflare Image Transformations (5,000 unique transformations a month free, then $0.50 per 1,000) costs $0 at today's usage and has no 25-credit ceiling. URL transformations must be enabled on a Cloudflare zone, so it fits only after the DNS move.
- Work: admin uploads to R2 (signed uploads), the CMS JSON as an R2 object, every image URL in the site and Shop, and the print-file crop rebuilt with Cloudflare's `trim` parameters. Output size limits for full-resolution print files were not confirmed; check them before moving the Shop.
- Effort: about 3–5 agent days.

## Recommendation

- Stay on Vercel and Cloudinary now: Cloudinary costs $0 with about 3× headroom, and the move saves at most $180/yr for about a week of work plus DNS and mail risk.
- Confirm the Vercel project is on Pro before the Shop takes real payments.
- Move hosting and images to Cloudflare together when client galleries are built (originals need cheap storage) or when Cloudinary passes about 20 credits a month.

## Sources

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers node:crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/), [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/), [Transform images](https://developers.cloudflare.com/images/transform-images/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Vercel pricing](https://vercel.com/pricing), [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines), [Cloudinary pricing](https://cloudinary.com/pricing)
