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

- Stripe-hosted Checkout, `mode: payment`, card, US shipping address, phone number.
- One Stripe line item per cart line, with the server price and a small preview image.
- **Shipping (sample):** one flat rate per order: $8 when every line is in Prints, $20 when any line is Wall Art. Real shipping, tax and the returns policy are open decisions for the user; no tax is collected yet.
- The session's metadata holds the order in compact form (one key per line: product slug, size, option values, photo ID, crop, quantity), because Stripe limits a metadata value to 500 characters. The webhook rebuilds product UIDs and file URLs from it with the same code that priced the cart.
- Return: `prints.html?checkout=success&session_id=…` calls `GET /api/shop-order?session_id=…`; the cart is cleared only when the server says the session is paid. `prints.html?checkout=cancelled` keeps the cart.

## After payment (slice 2, not built)

- `POST /api/stripe-webhook` verifies the signature, fetches the session again, checks that it is paid and that the amount equals the recomputed total, then creates one Gelato order with `orderType: "draft"` and `orderReferenceId` equal to the Stripe session ID, so a repeated webhook creates nothing new. A draft is not printed and not charged.
- Claire gets an order email through Resend; the customer gets Stripe's receipt.
- Open decision for release: whether paid orders go to Gelato as real orders automatically, or Claire approves each draft in the Gelato dashboard.
