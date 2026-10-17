# Pixieset: build into our admin, or buy?

Last Updated: 2026-10-14. Prices checked that day on the vendors' own pages (sources at the end). Pixieset help-centre figures came from search summaries only (the site refused fetches); verify them before quoting.

## Question

Can Claire's own site and admin do everything Pixieset sells, and is building it cheaper than paying Pixieset?

## Pixieset plans that match Claire

| Plan | Monthly | Annual (per month) | Storage | Notes |
|---|---|---|---|---|
| Client Gallery Plus | $20 | $16 | 100 GB | Galleries, downloads, favourites, store (0% commission on paid plans) |
| Client Gallery Pro | $30 | $24 | 1 TB | Adds RAW upload, bulk share |
| Studio Manager Plus | $15 | $12 | — | Invoices, contracts with e-sign, questionnaires, booking, reminders |
| Studio Manager Pro | $24 | $18 | — | Adds booking reminders, retainers, manual booking approval |
| Suite Starter | $35 | $28 | 100 GB | Gallery + Website + Store + App + Studio Manager |
| Suite Pro | $50 | $38 | 2 TB | Same, more storage and email |

Pixieset Payments charges the same card rate as Stripe (2.9% + $0.30), so card fees are not a difference between building and buying. Pixieset's store labs are WHCC, Mpix, Miller's and others, not Gelato.

## Feature map

Effort is agent-built days with CEO review, on our stack (Vercel functions, Cloudinary, Stripe, Resend, Convex). "Have" means built on `main` or `ui/shop-store`.

| Pixieset area | Our state | What building it takes | Effort |
|---|---|---|---|
| Website, portfolio, blog | Have (custom site); no blog, no analytics, no sitemap | Sitemap, analytics, SEO tags; blog only if wanted | 1–2 days |
| Print store, tax, lab fulfilment | Have on `ui/shop-store` (Gelato, Stripe Tax, Orders tab) | Coupons via Stripe promotion codes; gift cards later | 1–3 days |
| Private client galleries (password, favourites, comments, watermark, expiry, download tracking) | Missing; all albums are public | Gallery model, private links, originals in R2, signed downloads, ZIP download, favourites | 10–15 days |
| Digital delivery and download sales | Missing (booking packages promise digital images) | Part of galleries; paid downloads through existing checkout | 2–4 days |
| Selling prints from a client gallery | Missing | Reuse the Shop with a gallery photo source | 2–3 days |
| Invoices, deposits, payment plans, reminders | Missing | Stripe Checkout payment links per invoice, deposit schedule, reminder emails by cron | 4–6 days |
| Contracts with e-signature | Missing | DocuSeal (hosted) or our own click-to-sign with an audit record | 3–5 days |
| Booking and scheduling | Inquiry form only | Cal.com embed and webhook (2–3 days) or custom calendar (6–8 days) | 2–8 days |
| Questionnaires | Partly (client intake v1 on `feature/client-intake`) | Generalise intake into forms per booking | 2–3 days |
| CRM, projects, email templates | Missing | Contacts, project status, document history in Convex; templates in Resend | 5–8 days |
| Email campaigns and automation | Missing (Workshops form is inert) | Resend broadcasts or a mailing tool; sequences by cron | 3–5 days |
| Mobile gallery app | Missing | Installable web app (PWA) per gallery | 3–5 days |
| AI photo editor | Out of scope | Not worth building; use Lightroom | — |

Total to match the parts Claire would use: about 40–70 agent days, plus ongoing upkeep and responsibility for keeping private client photos private.

## Running cost of our own stack

| Item | Lean | Notes |
|---|---|---|
| Vercel Pro | $20/mo | Needed anyway: Vercel Hobby is non-commercial only, and the Shop takes payments. The project's current plan is not recorded; check it before the Shop release. |
| Gallery originals (Cloudflare R2 or Backblaze B2) | $3–9/mo | 30 galleries × 400 photos × 15 MB a year, and 3× that. Cloudinary Free cannot hold galleries (≈28 of 25 credits); Cloudinary Plus is $99/mo. |
| Contracts (DocuSeal) | $0–21/mo | Free hosted plan allows 10 signature requests a month by email link; Pro ($20 + $0.20/doc) adds embedding. |
| Booking (Cal.com Free) | $0 | One user, Stripe payments included. |
| Email (Resend Free) | $0 | 3,000 emails/mo covers reminders. Marketing Pro is $40/mo for 5,000 contacts if campaigns are wanted. |
| Database (Convex Free) | $0 | Pro price not published on official pages. |
| **Total** | **≈$23–50/mo** | Marginal over today's needs ≈$3–30/mo, because Vercel Pro is needed for the Shop either way. |

## Comparison

- Buying everything: Suite Pro $38/mo annual ($456/yr). Galleries plus business tools only: Client Gallery Plus + Studio Manager Plus = $28/mo annual ($336/yr).
- Building everything: ≈$23–50/mo to run (≈$3–30 marginal), plus 40–70 agent days to build. At freelance rates ($75–125/h) that build is $24k–70k; built by agents it is mostly the user's review time over several weeks.
- Savings from building: at most ≈$300–450/yr. The build never pays back at freelance rates and takes years even when agent-built.

## Recommendation

- **Keep building:** the website and the Shop (Gelato margins, own checkout, own admin). These are done or nearly done, and Pixieset's store would replace Gelato with its own labs.
- **Buy:** Pixieset Client Gallery (Plus, or Pro for 1 TB) for private galleries and delivery, and Studio Manager (Free or Plus) for invoices, contracts, questionnaires and booking. About $16–36/mo annual. Turn off the gallery store, or point "Order print" back to our Shop.
- **Build only cheap gaps:** sitemap and analytics, Stripe promotion codes in the Shop, and links from our Booking page into Pixieset's booking and our own pages.
- **Revisit** if Claire outgrows the plans or wants galleries inside her own admin: galleries are the one large build, and R2 keeps their storage cheap.

## Sources

- Pixieset: [pricing](https://pixieset.com/pricing/), [client gallery](https://pixieset.com/client-gallery/), [store](https://pixieset.com/online-store/), [website pricing](https://pixieset.com/pricing-website/), [Studio Manager pricing](https://pixieset.com/pricing-studio-manager/), [Suite pricing](https://pixieset.com/pricing-suite/), [Studio pricing](https://pixieset.com/pricing-studio/), [commission (help, via search)](https://help.pixieset.com/hc/en-us/articles/115002975072-How-does-the-0-commission-fee-work), [Payments fees (help, via search)](https://help.pixieset.com/hc/en-us/articles/31868053345805-Pixieset-Payments-Processing-Times-and-Fees)
- Our stack: [Vercel pricing](https://vercel.com/pricing), [Vercel fair use (Hobby non-commercial)](https://vercel.com/docs/limits/fair-use-guidelines), [Cloudinary pricing](https://cloudinary.com/pricing), [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Backblaze B2 pricing](https://www.backblaze.com/cloud-storage/pricing), [Convex limits](https://docs.convex.dev/production/state/limits), [Resend pricing](https://resend.com/pricing), [Stripe pricing](https://stripe.com/us/pricing), [DocuSeal pricing](https://www.docuseal.com/pricing), [Cal.com pricing](https://cal.com/pricing), [Gelato subscription](https://support.gelato.com/en/articles/8996313-how-much-does-gelato-subscription-cost)
