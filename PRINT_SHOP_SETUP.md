# Print Shop Setup

## Connected Setup

The connected sales path is:

1. The portfolio sends buyers to `shop.clairethomas.art`.
2. Shopify owns the product page, cart, checkout, customer payment, and order record.
3. Gelato owns the connected print variant, production charge, printing, shipping, tracking, and fulfillment updates.
4. Shopify Payments pays store proceeds into the configured Shopify Balance account.

## Product Catalog

Every CMS photograph with `printEnabled: true` receives one product:

- Fine Art Print: three aspect-ratio-matched sizes.

Size groups:

| Photograph ratio | Fine Art |
| --- | --- |
| Square | 10x10, 12x12, 16x16 in |
| Classic | 8x10, 12x16, 16x20 in |
| Wide | 8x12, 12x18, 16x24 in |

The fulfillment inventory is CMS-authoritative: only items with `printEnabled: true` are included, and the storefront presents one card per photograph. The script reads `content/portfolio.json` by default or an explicit public CMS snapshot with `--content-file`; it does not use `site.js` as catalog truth.

The Gelato Fine Art master template must include both orientations and all nine sizes.

Add the template IDs to `.env.gelato.local`:

```text
GELATO_FINE_ART_TEMPLATE_ID=

# Shopify Admin API: put these in ignored .env.shopify.local, not source control.
SHOPIFY_STORE_DOMAIN=esf4bj-wk.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_API_VERSION=2026-07
```

The Shopify app must have `read_products`, `write_products`, `read_publications`, and `write_publications`. The last two let reconcile confirm and publish each repaired product to the Online Store.

Then run:

```bash
# Generate a manifest from the current portfolio.
node scripts/gelato-products.mjs --content-file /path/to/cms-snapshot.json

# Confirm every required template variant and placeholder exists.
node scripts/gelato-products.mjs --validate-templates

# Preview the Fine Art action for one photograph (dry-run; no mutation).
node scripts/gelato-products.mjs --reconcile --content-file /path/to/cms-snapshot.json --only the-natural-world-3

# After inspecting that product in Shopify, create the remaining public catalog.
# Low concurrency lets Gelato drain large background publishing queues.
node scripts/gelato-products.mjs --reconcile --execute --content-file /path/to/cms-snapshot.json

# Report products for photographs removed from the portfolio.
node scripts/gelato-products.mjs --audit

# One-shot sync runner used by the admin-triggered workflow; dry-run by default.
node scripts/portfolio-print-sync.mjs

# Explicit production reconcile after credentials/templates are configured.
node scripts/portfolio-print-sync.mjs --execute
```

The script writes `.gelato-product-state.json` after each product. Re-running reconcile recovers already-existing products, creates only missing enabled items, updates album/photo metadata, and archives products no longer enabled. It retries Gelato throttling responses and monitors publishing through catalog snapshots. A pending Gelato product is quarantined as a Shopify Draft only after Gelato exposes its exact Shopify `externalId`; an `active` response without that mapping remains pending and is polled again. After artwork repair succeeds, reconciliation activates the Shopify product and explicitly publishes it to the Online Store; strict audit fails active products missing that publication. If products are already publishing, reconcile drains and repairs that batch before requesting additional products, preventing a saturated queue from holding one create request in hours of `429` backoff. The admin-triggered workflow uses exit code 75 for bounded Gelato `429`/publishing failures and Shopify asynchronous media/job/binding timeouts, then allows at most five serialized continuations; unrelated failures never self-retry. Stable CMS `item.id` tags prevent album rename, move, or reorder from changing photo identity. Review `.gelato-reconcile-plan.json` before any `--execute` run.

### Size-Specific Product Preview Repair

The Gelato master template must use portrait image placeholders for every Vertical variant and landscape placeholders for every Horizontal variant; `--validate-templates` rejects mismatches before creation. On every normal reconcile, the script idempotently uploads the original Cloudinary artwork using the alt marker `Claire Thomas artwork: <print-id>`. Each Fine Art Shopify variant is bound to the exact Gelato mockup whose `productVariantIds` contains that variant's Shopify SKU. This avoids Gelato's unreliable external-ID mapping. The Horizon override shows only the selected size's mockup and retains the marker artwork as a secondary zoomable image. Pending media processing, reorder, and binding steps are restart-safe, and interrupted runs do not upload duplicate artwork markers.

Run the migration through the normal CMS-authoritative reconcile:

```bash
node scripts/gelato-products.mjs --reconcile --execute --content-file /path/to/cms-snapshot.json
node scripts/gelato-products.mjs --strict-audit --content-file /path/to/cms-snapshot.json
```

The strict audit must report `mediaRepairKeys: 0` and `unpublishedProducts: 0`. It checks Online Store publication, the product's artwork marker, and every Fine Art variant's exact size-specific Gelato mockup association.

Archiving is explicit and reversible: reconcile sends Shopify `productUpdate(status: ARCHIVED)` for disabled, stale, duplicate, or superseded products; it never calls a delete endpoint. Missing Shopify mappings block execution for review. Catalog-version changes archive superseded products before creating replacements.

The runner fetches the public CMS revision, writes a pending marker before reconcile, and advances `lastSuccessfulRevision` only after the child reconcile exits successfully. It also records the catalog-sync contract version, so a release that changes reconciliation requirements (such as Online Store publication) reruns once even when the CMS revision is unchanged. It uses an exclusive lock to prevent overlapping manual workflow invocations. If `SHOPIFY_ADMIN_ACCESS_TOKEN` is absent, reconcile requests a 24-hour Shopify Dev Dashboard client-credentials token from `/admin/oauth/access_token`; tokens and secrets are never logged or written to state.

The administrator’s **Sync shop** button saves pending content first, then calls the authenticated `/api/admin/shop-sync` endpoint. That endpoint dispatches `.github/workflows/portfolio-shop-sync.yml`; it does not run on a timer. Configure `GITHUB_SHOP_SYNC_TOKEN` in Vercel with Actions write access to `atishaycn/c_portfolio`, and configure the Gelato/Shopify values used by the workflow as GitHub Actions secrets.

Copy each credential in Shopify, then capture it without printing it:

```bash
node scripts/capture-shopify-credential.mjs --client-id
node scripts/capture-shopify-credential.mjs --client-secret
```

Each product receives a deterministic canonical handle and Fine Art URL in `.gelato-product-manifest.json`. Before replacing or archiving a product, reconcile changes its Shopify handle to `archived-<stable-id>` with `redirectNewHandle: false`, preventing `-1` collisions. New Gelato products are then updated to their canonical handle, metadata, and `ACTIVE` status once Shopify mapping is available. If a Shopify-only orphan still owns that handle, reconcile archives and deterministically renames it only when its `photo-id`, format, catalog-version, and `claire-thomas` identity tags exactly match the incoming managed product and it is either already Draft or demonstrably unusable (Active with zero media and every variant unbound). Usable Active products and products with different or incomplete identity tags are never changed. The recovery is restart-safe and retries one handle assignment after a Shopify handle-taken race.

Before creation, inventory is listed by `createdAt` and `updatedAt` in both directions until two consecutive ID sets match. Every create mode then checks the canonical Shopify handle and writes a two-hour pre-POST reservation. GitHub Actions carries that ignored state through bounded continuations using a run-specific cache. Ambiguous or JSON `5xx` POST responses are not replayed; repair mode archives any mapped Shopify product before deleting its Gelato record.

## Site Integration

1. Buyers open any non-commissioned gallery photo.
2. The lightbox shows `Order print`.
3. The link opens the photograph's canonical Fine Art product page directly.
4. The product page offers three composition-matched Fine Art sizes.
5. The selected size shows its Gelato product mockup; the original artwork remains available as a secondary image.

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

1. Create and validate the Gelato Fine Art master template.
2. Create one hidden test product for `the-natural-world-3`.
3. Inspect composition, size-specific mockups, variants, prices, and shipping.
4. Create the remaining public catalog.
5. Verify direct Fine Art product links and size choices from each gallery.
6. Archive obsolete test listings.
7. Place one real test order and verify Gelato fulfillment and tracking.
