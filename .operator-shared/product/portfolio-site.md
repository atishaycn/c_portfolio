# clairethomas.art — Product Charter

## Purpose

- Photography portfolio and booking site for Claire Thomas (Claire Thomas Art, San Francisco). Goal: SF event bookings and print sales, not traffic for its own sake.
- One of the user's two focus projects (the other is `~/Developer/social_media_manager`, which also owns Claire's Instagram @cet.samoht). Iterate on what exists; don't start new products.
- Claire edits content herself through `/admin.html`. Anything Claire must change regularly belongs in the content manager, not in code.

## Services and accounts

| Concern | Service | Notes |
|---|---|---|
| Hosting, server functions | Vercel project `c-portfolio` | Git integration: `main` → production. Previews need a Vercel login. |
| Photos and CMS content | Cloudinary cloud `dpmdkrggj`, Free plan | Content is one raw JSON asset with revisions. ~20% of 25 monthly credits after the 2026-10-04 Trash cleanup. Full backup: `~/Developer/cloudinary-backup-2026-10-04/`. |
| Inquiry email | Resend, domain `clairethomas.art` | Key `RESEND_API_KEY` in Vercel. |
| DNS, `contact@` forwarding | Namecheap | Never switch Mail Settings to Custom MX; it breaks `contact@` forwarding. |
| Print shop (live) | Shopify `shop.clairethomas.art` + Gelato fulfilment | Header "Shop" links here. Sync: `.github/workflows/portfolio-shop-sync.yml`, `PRINT_SHOP_SETUP.md`. |
| Print checkout pilot | Stripe (test mode only) | Branch `shop/stripe-print-pilot`; refuses live keys. |
| Client intake backend | Convex (team "Atishay Jain's team"; dev `veracious-partridge-753`) | Branch `feature/client-intake`. Browser never talks to Convex directly; Vercel functions sit in front (ADR 0001 on that branch). |
| Photo source of truth (planned) | Google Drive folder `1j_p4uDzt0QPy18iu5K9uKnkoYVphUzaD` (`cporfltiopiocsog`), owner sunnyjaincn@gmail.com | GCP project `clairethomas-site`; `GOOGLE_DRIVE_API_KEY` in Vercel. Drive images load ~3× slower than Cloudinary and Google gives no delivery guarantee. |

## Settled decisions

- Albums on the site: Events (`protests`), Nature (`the-natural-world`), Street (`shapes-and-shadows`), Slideshow (homepage only), Special occasions (nested under Events). Old album pages (`california`, `san-francisco`, `india`, `commissioned-work`) are orphaned; cleanup deferred by the user.
- Booking testimonials stay hidden until Claire supplies real quotes (`bookingConfig.showTestimonials`).
- The Drive replacement is per-album folders under `Website/` in the Drive folder, using shortcuts for byte-exact matches and uploads of backed-up originals for the rest. Visual (non-exact) matches need explicit approval.
