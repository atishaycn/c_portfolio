# clairethomas.art — Product Charter

## Purpose

- Photography portfolio and booking site for Claire Thomas (Claire Thomas Art, San Francisco). Goal: SF event bookings and print sales, not traffic for its own sake.
- One of the user's two focus projects (the other is `~/Developer/social_media_manager`, which also owns Claire's Instagram @cet.samoht). Iterate on what exists; don't start new products.
- Claire edits content herself through `/admin.html`. Anything Claire must change regularly belongs in the content manager, not in code.

## Services and accounts

| Concern | Service | Notes |
|---|---|---|
| Hosting, server functions | Vercel project `c-portfolio` | Git integration: `main` → production. Previews need a Vercel login. |
| Photos and CMS content | Cloudinary cloud `dpmdkrggj`, Free plan | Content is one raw JSON asset with revisions. 27% of 25 monthly credits on 2026-10-14 (2.6 GB stored, 2.8 GB delivered a month). Full backup: `~/Developer/cloudinary-backup-2026-10-04/`. |
| Inquiry email | Resend, domain `clairethomas.art` | Key `RESEND_API_KEY` in Vercel. |
| DNS, `contact@` forwarding | Namecheap | Never switch Mail Settings to Custom MX; it breaks `contact@` forwarding. |
| Print shop (closing) | Shopify `shop.clairethomas.art` + Gelato fulfilment | Not linked from the header; the lightbox "Order print" link on print-enabled photos still goes here. Closes when the Shop store goes live. Sync: `.github/workflows/portfolio-shop-sync.yml`, `PRINT_SHOP_SETUP.md`. |
| Print lab | Gelato (store `GELATO_STORE_ID`, key in `.env.gelato.local`) | The only lab. The Shop store sends paid orders through the Gelato order API. The account still holds 48 Shopify-connected products and 4 templates from the old shop; delete them when Shopify closes, after the user confirms the exact list. The Gelato store is the Shopify-app connection to `esf4bj-wk.myshopify.com` with `orderApproval: auto` (a Shopify order goes to print and is charged with no review). Login email is not recorded and the API does not return it; no Gelato mail is in the user's three Gmail inboxes (checked 2026-10-22), so it is most likely Claire's login. |
| Shop payment | Stripe | Account "Print Store" (`acct_1UQHdCJ0O7SZaOmQ`), created 2026-10-13 in a new organization under Claire's login, so card statements can show her name. Not activated yet; its statement name was copied as `BUYMEACOFFEE.COM` and must be changed before real sales. The CLI is paired with its sandbox and can create test checkouts and webhook secrets; server code needs a sandbox secret key in git-ignored `.env.stripe.local`. Pairing details and what the user still owes: `plans/work-board.md`, "Shop store: state at hand-off". Her existing account `acct_1TnNSUJAb1tywB97` ("Buymeacoffee", statement name `BUYMEACOFFEE.COM`) belongs to Buy Me a Coffee: never charge through it or change its settings. The Stripe CLI on `servesunny` (`~/.local/bin/stripe`) is paired by browser approval; test in a sandbox only. Pilot code on `shop/stripe-print-pilot` is test mode only and refuses live keys. |
| Client intake backend | Convex (team "Atishay Jain's team"; dev `veracious-partridge-753`) | Branch `feature/client-intake`. Browser never talks to Convex directly; Vercel functions sit in front (ADR 0001 on that branch). |
| Photo source of truth (planned) | Google Drive folder `1j_p4uDzt0QPy18iu5K9uKnkoYVphUzaD` (`cporfltiopiocsog`), owner sunnyjaincn@gmail.com | GCP project `clairethomas-site`; `GOOGLE_DRIVE_API_KEY` in Vercel. Drive images load ~3× slower than Cloudinary and Google gives no delivery guarantee. |

## Settled decisions

- Albums on the site: Events (`protests`), Nature (`the-natural-world`), Street (`shapes-and-shadows`), Slideshow (homepage only), Special occasions (nested under Events). Old album pages (`california`, `san-francisco`, `india`, `commissioned-work`) are orphaned; cleanup deferred by the user.
- Print sales (2026-10-13): the Shop store on `prints.html` (`specs/shop-store.md`) replaces the Shopify shop. Gelato is the only lab and the catalog is limited to what Gelato makes. Stripe takes payment.
- Booking testimonials are real client quotes only, each beside a photo from that shoot; Claire adds them in the admin. No client name is shown until the user supplies one.
- The Drive replacement is per-album folders under `Website/` in the Drive folder, using shortcuts for byte-exact matches and uploads of backed-up originals for the rest. Visual (non-exact) matches need explicit approval.
