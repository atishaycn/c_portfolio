# Shop Checkout

How a cart in the Shop store (`specs/shop-store.md`) becomes a Stripe payment and a Gelato order. Built in slices on `ui/shop-store`; the pilot on `shop/stripe-print-pilot` is the reference for the Stripe and print-file checks (copy its logic, do not merge the branch).

## Invariants

- **The server sets every price.** The browser sends only what the customer chose; the server reads `content/shop-catalog.json` and the authoritative CMS content (never the bundled fallback) and recomputes each line. A price, product UID or file URL from the browser is ignored.
- **Test mode only until release.** Checkout runs only with a Stripe key that starts `sk_test_` and never when `VERCEL_ENV` is `production`. Removing this guard is part of the release step and needs user approval.
- **Tests never place a paid order** and never call Stripe or Gelato over the network.
- **A success URL is not proof of payment.** The return page and the webhook each ask Stripe for the session and check it.
- Secrets live in git-ignored env files locally (`.env.stripe.local`, `.env.gelato.local`, `.env`) and in Vercel env for deploys.

## Cart request

`POST /api/shop-checkout` with `{ "lines": [ { "productSlug", "size", "options", "photoId", "crop": { "x", "y" }, "quantity" } ] }`.

The request is refused with HTTP 400 and a message the cart can show, and nothing is charged, when: a product, size or option set is not a variant in the catalog; a photo is not in the CMS or is not print-enabled (album or item); the photo is too small for the size; quantity is not a whole number from 1 to 10; there are no lines or more than 20.

## Rules for a line

- **Orientation** comes from the photo: `hor` when width ≥ height, else `ver`. The Gelato product UID is the variant's `productUid` for that orientation.
- **Photo size check:** a size is sold for a photo only when the original has at least 125 pixels per printed inch on both sides, after orientation. The store hides sizes that fail; the server refuses them. 125 is a default the CEO picked (all current print-enabled photos are at least 3456 x 3888 px, so the largest sizes stay available); raise it if prints look soft.
- **Print file:** the full-resolution Cloudinary original, cropped on the server to the size's aspect ratio. The customer's crop offset (`x`, `y`, each −50 to +50 percent of the spare length) moves the crop window; 0 is centred. The URL is built from the CMS `publicId`, and the original is confirmed to exist with the same dimensions before checkout. Never a gallery preview.

## Payment

- Stripe-hosted Checkout, `mode: payment`, US shipping address, phone number. Payment methods come from the Stripe Dashboard settings: the current Stripe API refuses `payment_method_types` on a Checkout Session.
- One Stripe line item per cart line, with the server price and a small preview image.
- **Shipping:** one flat rate per order: the Prints rate when every line is in Prints, the Wall Art rate when any line is Wall Art (defaults $8 and $20; Claire sets both in the admin, `specs/shop-admin.md`).
- **Sales tax: Stripe Tax** (user decision, 2026-10-14). Checkout sets `automatic_tax`; prices and shipping are tax-exclusive; products use the account's default tax code (general tangible goods), shipping uses the shipping tax code. Stripe adds tax on top, so `amount_total` = catalog total + tax. Live needs Claire's head office address and her California registration in the Print Store tax settings; the sandbox uses a San Francisco placeholder address and a CA registration.
- **Returns: damage or defect only** (user decision, 2026-10-14). Prints are made to order, so there are no change-of-mind returns. A buyer who gets a damaged or wrong item sends a photo within 30 days and gets a free reprint or a refund. The cart and the Stripe page both show this.
- The session's metadata records the settings it was priced with (`pricing`: markup and both shipping rates), and the webhook and return page reprice with them.
- The session's metadata holds the order in compact form (one key per line: product slug, size, option values, photo ID, crop, quantity), because Stripe limits a metadata value to 500 characters. The webhook rebuilds product UIDs and file URLs from it with the same code that priced the cart.
- Return: `prints.html?checkout=success&session_id=…` calls `GET /api/shop-order?session_id=…`; the cart is cleared only when the server says the session is paid. `prints.html?checkout=cancelled` keeps the cart.

## Local testing

- `npm run dev:shop` (`scripts/serve-shop.mjs`) serves the site and the shop endpoints on `127.0.0.1:8096` with checkout enabled. It serves the whole worktree, so it stays bound to localhost.
- The local admin: open `http://127.0.0.1:8096/__dev/admin-login` (a one-hour session signed with the admin secret). It reads the live CMS content but cannot save it: a save would change the live site.
- The request must carry an `Origin` equal to `SHOP_SITE_URL`, and a non-local origin must be https. A phone test over the tailnet therefore needs an https address (for example `tailscale serve`), not `http://100.87.15.27`.
- The Stripe CLI paired with the sandbox can check a request shape without the secret key: `stripe post /v1/checkout/sessions -d …`, then expire the session.

## After payment (slice 2)

- `POST /api/stripe-webhook` verifies the signature with `STRIPE_WEBHOOK_SECRET` on the raw body, handles `checkout.session.completed` and `checkout.session.async_payment_succeeded` in test mode only, fetches the session again from Stripe, and ignores sessions this app did not create. An unpaid session is acknowledged and left alone.
- For a paid session it rebuilds the cart from the metadata, checks that the recomputed total equals the paid amount before tax (`amount_total` − `total_details.amount_tax`), and creates one Gelato order through `POST https://order.gelatoapis.com/v4/orders` with `orderType: "draft"`, `orderReferenceId` equal to the Stripe session ID, one item per line (product UID, cropped print file URL, quantity) and the shipping address, name, email and phone from the session. A draft is not printed and not charged.
- **One order per payment.** Before creating, the webhook looks for the Gelato order ID on the session's metadata, then searches Gelato by `orderReferenceId` (`POST /v4/orders:search`). After creating, it writes the Gelato order ID to the session's metadata. A repeated or concurrent webhook therefore creates nothing new.
- A Gelato or Stripe failure answers HTTP 500 so that Stripe retries. The customer's address and email are never written to logs or responses.
- Claire gets an order email through Resend (`SHOP_ORDER_TO`, default `contact@clairethomas.art`): lines, total, the customer's name and city, and the Gelato order ID. The email is sent once per order and only when `RESEND_API_KEY` is set; a failed email does not fail the webhook. The customer gets Stripe's receipt.
- If the recomputed total differs from the paid amount (a price changed between cart and webhook), or the cart can no longer be priced (a product or photo was removed), no order is created, Claire is told by email once, and the webhook answers 200. A paid order must never be dropped silently.
- Known limit: two deliveries of one event handled at the same moment by two server instances could both create a draft; the lock is per process and Gelato has no create-time idempotency key. Drafts are not printed, so Claire can delete a duplicate.
- Canvas: the print file is cropped to the face size only. Gelato fills the sides from the photo (checked on a draft mockup, 2026-10-14: no white sides). The API gives a draft no preview; the Gelato dashboard shows one.
- **Draft orders, Claire approves** (user decision, 2026-10-14): paid orders stay Gelato drafts; Claire checks each and submits it in the Gelato dashboard. Her order email says so. Switching to automatic orders is a later decision.
