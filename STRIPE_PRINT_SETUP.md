# Stripe print sandbox

This branch replaces the public Shopify links with local print availability. The existing Shopify/Gelato catalog scripts and admin sync remain unchanged. Do not run their mutation commands while testing this pilot.

## What is built

- One CMS photograph, `the-natural-world-10`.
- One 12 × 16 inch unframed fine-art size, quantity one, US delivery only.
- A $40 USD sandbox price with shipping included. This is not an approved retail price, shipping quote, or tax calculation.
- Stripe-hosted test checkout with email, phone, and shipping address collection.
- A signed webhook that retrieves the current Stripe session, validates the payment and draft print-order fields, and records `pilot_validation=passed` on the session.
- A return page that verifies payment on the server. A success URL alone does not count as payment.

**Nothing is sent to Gelato.** The draft payload exists only in memory during validation. No physical order, draft order, production charge, or shipping request is created. The webhook records only a validation marker and deterministic reference in Stripe, not the customer's address.

The pilot rejects live Stripe keys and is always disabled when `VERCEL_ENV=production`. It is off by default outside the local development server. Do not deploy or merge this branch as a finished shop.

## Local setup

Use Node 22.9 or newer. Work from the isolated checkout:

```sh
cd /Users/sa/Developer/c_portfolio-stripe-shop
npm ci
npm run check
```

Put the existing Cloudinary values in ignored `.env.local`:

```dotenv
CLOUDINARY_CLOUD_NAME=dpmdkrggj
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

The catalog reads the authoritative Cloudinary CMS. It does not use bundled fallback content for print eligibility. Checkout also verifies the original resource's ID, dimensions, format, and version. Files must be 4:3 and provide at least 300 pixels per printed inch. The gallery uses a small preview, but the draft payload uses the full-resolution versioned original without automatic compression.

Create ignored `.env.stripe.local`:

```dotenv
PRINT_CHECKOUT_ENABLED=true
PRINT_SITE_URL=http://localhost:8091
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Use a key beginning `sk_test_` from the Stripe sandbox or test-mode API keys page. Never paste keys into chat or commit these files. A publishable key is not needed because the server creates the hosted Checkout Session and the browser follows its URL.

Start a Stripe CLI listener in a separate terminal:

```sh
stripe login
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to http://localhost:8091/api/stripe-webhook
```

Put the listener's `whsec_` signing secret in `.env.stripe.local`, then start or restart the local server:

```sh
npm run dev:prints
```

Open `http://localhost:8091/prints.html`. Use this hostname consistently; `127.0.0.1` is a different checkout origin. Checkout stays disabled until the test key, signing secret, and trusted origin are configured. The listener must stay running to deliver events.

This local server binds to loopback, serves an explicit static-file allowlist, and exposes only the public content and sandbox print APIs. It does not expose env files, admin routes, uploads, or shop-sync mutation endpoints. Do not use a generic static-file server from a directory containing credentials.

## One-product test

1. Open Prints. Confirm the photograph, nominal 12 × 16 size, test price, and sandbox warning.
2. Choose **Try test checkout**. Confirm Stripe shows test mode and one $40 item.
3. Enter test card `4242 4242 4242 4242`, a future expiry, any three-digit CVC, and test US contact/shipping details. Do not use a real card.
4. Finish checkout. Confirm the return page reports a verified test payment, then a webhook-validated draft. It must also say nothing was sent to Gelato.
5. In Stripe, inspect the Checkout Session metadata for `pilot_validation=passed` and `pilot_order_reference=stripe-test-<session-id>`.
6. Confirm the listener received a successful response. Resend the event from Stripe or its CLI and confirm the same validation result. Duplicate events cannot produce a Gelato order because there is no Gelato submission code.
7. Cancel a separate checkout and verify the page does not claim payment succeeded.

Stripe's generic `stripe trigger checkout.session.completed` fixture is not this application's session and is deliberately ignored. Use the actual hosted checkout above for the end-to-end test.

If payment is confirmed but validation stays pending, check that the listener is running and its signing secret matches the server's environment. A validation or provider failure returns HTTP 500 so Stripe can retry. Invalid signatures return HTTP 400. The return page polls at most six times and then directs you to webhook delivery logs.

## Preview deployment, only when explicitly requested

Set Cloudinary credentials and the four pilot variables in the Vercel **Preview** environment only. Set `PRINT_SITE_URL` to the exact HTTPS preview origin. Create a Stripe test-mode webhook endpoint at that origin's `/api/stripe-webhook`, subscribe to the two events above, and use that endpoint's signing secret. A CLI listener secret is not interchangeable with a deployed endpoint secret. Redeploy after changing environment variables.

The Node function reads restored raw `data`/`end` events before touching Vercel's parsed `request.body`. Vercel's original request iterator can already be ended, so simply iterating it is not sufficient. A regression test reproduces that restoration on a real Node HTTP request. Verify signature handling against a real Stripe delivery in preview before treating deployment as tested. Production remains blocked by code, regardless of its environment variables.

## Required before real sales

This pilot is not live fulfilment. Removing its safety gates is not sufficient to launch.

- Approve product choices, margins, destination-specific shipping, taxes, and refund/customer-support terms. The earlier US quote was only a read-only lookup for one destination.
- Preserve immutable print-file snapshots. A Cloudinary versioned URL is not a guarantee that an overwritten or deleted source remains available.
- Add a durable order store with atomic payment-to-order claiming, provider-order mapping, retry state, and reconciliation of ambiguous Gelato responses. Stripe metadata and a deterministic order reference are not cross-provider exactly-once fulfilment.
- Confirm the current Gelato order API contract and product UID, validate artwork placement, and explicitly authorize the first physical test order. Do not assume the in-memory draft has been accepted by Gelato.
- Add failed-order alerts, operational retry tools, customer notifications, tracking, and refund handling. Do not acknowledge an order as fulfilled just because a payment was received.
- Protect public checkout from abuse and provider rate limits, separate credentials by environment, and define retention/access rules for shipping data.
- Run an approved end-to-end physical test before enabling real payments or opening the wider catalog.

## Checked locally

- 120 automated checks passed, including a signed webhook through Vercel-style raw-stream restoration and repeat delivery.
- The local UI was checked at 1280 × 800, 390 × 844, and 375 × 667. The actual Cloudinary photo loaded, the layout had no horizontal overflow, and unconfigured checkout stayed disabled.
- Forged success URLs were rejected; cancelled checkout did not claim a payment. Credential-file URLs and admin mutation routes returned 404 on the local server.
- A hosted Stripe payment and Vercel deployment have not been tested. Stripe test credentials are still needed. No Gelato order has been sent.

## Evidence and references

`npm run check` exercises server-owned pricing, eligibility, original-file verification, origin rejection, test-only gating, raw signature checks, paid-session validation, duplicate webhook delivery, and minimal status responses. Local browser checks do not substitute for a hosted Stripe test payment.

- Stripe fulfilment guidance: https://docs.stripe.com/checkout/fulfillment
- Stripe webhook signatures: https://docs.stripe.com/webhooks/signature
- Stripe test cards: https://docs.stripe.com/testing
- Stripe shipping collection: https://docs.stripe.com/payments/collect-addresses
- Vercel raw-stream restoration: https://github.com/vercel/vercel/blob/main/packages/node/src/serverless-functions/helpers.ts
