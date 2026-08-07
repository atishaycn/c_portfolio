# Print Shop Setup

## Connected Setup

The connected sales path is:

1. The portfolio sends buyers to `shop.clairethomas.art`.
2. Shopify owns the product page, cart, checkout, customer payment, and order record.
3. Gelato owns the connected print variant, production charge, printing, shipping, tracking, and fulfillment updates.
4. Shopify Payments pays store proceeds into the configured Shopify Balance account.

## Product Catalog

Commissioned Work is excluded. Every current non-commissioned photograph receives:

- Fine Art Print: three aspect-ratio-matched sizes.
- Framed Fine Art Print: the same three sizes, with Black and Natural Wood frames.
- Canvas Print: three aspect-ratio-matched sizes.

Size groups:

| Photograph ratio | Fine Art | Framed | Canvas |
| --- | --- | --- | --- |
| Square | 10x10, 12x12, 16x16 in | 12x12, 16x16, 20x20 in | 8x8, 12x12, 16x16 in |
| Classic | 8x10, 12x16, 16x20 in | 8x10, 12x16, 16x20 in | 8x10, 12x16, 16x20 in |
| Wide | 8x12, 12x18, 16x24 in | 8x12, 12x18, 16x24 in | 8x12, 12x18, 16x24 in |

The fulfillment inventory is CMS-authoritative: only items with `printEnabled: true` are included, and the storefront presents one card per photograph. The script reads `content/portfolio.json` by default or an explicit public CMS snapshot with `--content-file`; it does not use `site.js` as catalog truth.

Create one Gelato master template for each product type. Each template must include both orientations and all nine sizes. The framed template must include Black and Natural Wood variants.

Add the template IDs to `.env.gelato.local`:

```text
GELATO_FINE_ART_TEMPLATE_ID=
GELATO_FRAMED_TEMPLATE_ID=
GELATO_CANVAS_TEMPLATE_ID=

# Shopify Admin API: put these in ignored .env.shopify.local, not source control.
SHOPIFY_STORE_DOMAIN=esf4bj-wk.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_API_VERSION=2026-07
```

Then run:

```bash
# Generate a manifest from the current portfolio.
node scripts/gelato-products.mjs --content-file /path/to/cms-snapshot.json

# Confirm every required template variant and placeholder exists.
node scripts/gelato-products.mjs --validate-templates

# Preview the three product actions for one photograph (dry-run; no mutation).
node scripts/gelato-products.mjs --reconcile --content-file /path/to/cms-snapshot.json --only the-natural-world-3

# After inspecting those three products in Shopify, create the remaining public catalog.
# Low concurrency lets Gelato drain large background publishing queues.
node scripts/gelato-products.mjs --reconcile --execute --content-file /path/to/cms-snapshot.json

# Report products for photographs removed from the portfolio.
node scripts/gelato-products.mjs --audit

# LaunchAgent-friendly one-shot poller; dry-run by default.
node scripts/portfolio-print-sync.mjs

# Explicit production reconcile after credentials/templates are configured.
node scripts/portfolio-print-sync.mjs --execute
```

The script writes `.gelato-product-state.json` after each product. Re-running reconcile recovers already-existing products, creates only missing enabled items, updates album/photo metadata, and archives products no longer enabled. It retries Gelato throttling responses and monitors publishing through catalog snapshots. Stable CMS `item.id` tags prevent album rename, move, or reorder from changing photo identity. Review `.gelato-reconcile-plan.json` before any `--execute` run.

Archiving is explicit and reversible: reconcile sends Shopify `productUpdate(status: ARCHIVED)` for disabled, stale, duplicate, or superseded products; it never calls a delete endpoint. Missing Shopify mappings block execution for review. The edge-to-edge catalog version archives old `meet` products before creating replacements.

The poller fetches the public CMS revision, writes a pending marker before reconcile, and advances `lastSuccessfulRevision` only after the child reconcile exits successfully. It uses an exclusive lock to prevent overlapping LaunchAgent invocations. If `SHOPIFY_ADMIN_ACCESS_TOKEN` is absent, reconcile requests a 24-hour Shopify Dev Dashboard client-credentials token from `/admin/oauth/access_token`; tokens and secrets are never logged or written to state.

After the first manual execute and strict audit pass, install the 15-minute poller:

```bash
cp launchd/art.clairethomas.portfolio-print-sync.plist ~/Library/LaunchAgents/
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/art.clairethomas.gelato-catalog.plist 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/art.clairethomas.portfolio-print-sync.plist
launchctl print "gui/$(id -u)/art.clairethomas.portfolio-print-sync"
```

The new job replaces the obsolete one-shot `art.clairethomas.gelato-catalog` repair job. Do not install both.

Copy each credential in Shopify, then capture it without printing it:

```bash
node scripts/capture-shopify-credential.mjs --client-id
node scripts/capture-shopify-credential.mjs --client-secret
```

Each product receives a deterministic canonical handle and Fine Art URL in `.gelato-product-manifest.json`. Before replacing or archiving a product, reconcile changes its Shopify handle to `archived-<stable-id>` with `redirectNewHandle: false`, preventing `-1` collisions. New Gelato products are then updated to their canonical handle, metadata, and `ACTIVE` status once Shopify mapping is available.

## Site Integration

1. Buyers open any non-commissioned gallery photo.
2. The lightbox shows `Order print`.
3. The link opens the photograph's canonical Fine Art product page directly.
4. The Horizon theme presents Fine Art, Framed, and Canvas as print-type choices on that page.
5. Each choice opens its Gelato-connected Shopify product while keeping the same product-detail experience.

The live theme code is tracked in `shopify-theme-overrides/ct-product-consolidation.liquid`. Include it before `</body>` in `layout/theme.liquid`.

## Product Naming

Use the same IDs in shop listings:

```text
the-natural-world-1
california-12
san-francisco-83
india-4
shapes-and-shadows-7
protests-2
```

## Launch Checklist

1. Create and validate the three Gelato master templates.
2. Create three hidden test products for `the-natural-world-3`.
3. Inspect composition, mockups, variants, prices, and shipping.
4. Create the remaining public catalog.
5. Verify direct product links and all three print-type choices from each gallery.
6. Archive obsolete test listings.
7. Place one real test order and verify Gelato fulfillment and tracking.
