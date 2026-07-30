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

Current generated inventory: 270 photographs and 810 products. The script recalculates these counts from `site.js` on every run.

Create one Gelato master template for each product type. Each template must include both orientations and all nine sizes. The framed template must include Black and Natural Wood variants.

Add the template IDs to `.env.gelato.local`:

```text
GELATO_FINE_ART_TEMPLATE_ID=
GELATO_FRAMED_TEMPLATE_ID=
GELATO_CANVAS_TEMPLATE_ID=
```

Then run:

```bash
# Generate a manifest from the current portfolio.
node scripts/gelato-products.mjs

# Confirm every required template variant and placeholder exists.
node scripts/gelato-products.mjs --validate-templates

# Create one hidden product of each type for one photograph.
node scripts/gelato-products.mjs --execute --only the-natural-world-3 --limit 3

# After inspecting those three products in Shopify, create the remaining public catalog.
# Low concurrency lets Gelato drain large background publishing queues.
node scripts/gelato-products.mjs --execute --visible --concurrency 1

# Report products for photographs removed from the portfolio.
node scripts/gelato-products.mjs --audit
```

The script writes `.gelato-product-state.json` after each product. Re-running it recovers already-existing products and creates only missing ones. It retries Gelato throttling responses and monitors publishing through catalog snapshots rather than polling every product separately. Adding or deleting an entry in `site.js` changes the next manifest automatically; stable filename-based print IDs prevent reordering from changing existing product identities.

Deletion is intentionally two-step: `--audit` writes `.gelato-stale-products.json`, including Shopify product IDs. Review that file, then archive those listings in Shopify. The script never deletes products automatically.

## Site Integration

1. Buyers open any non-commissioned gallery photo.
2. The lightbox shows `Order print`.
3. The link uses a stable print ID, such as `the-natural-world-1`.
4. Shopify tags connect the photograph to its Fine Art, Framed, and Canvas listings.
5. Shopify search presents the photograph's Fine Art, Framed, and Canvas listings as the chooser.

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
5. Verify the three-format chooser from each gallery.
6. Archive obsolete test listings.
7. Place one real test order and verify Gelato fulfillment and tracking.
