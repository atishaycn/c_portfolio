# Shop simplification review

Reviewed September 30, 2026 (America/Los_Angeles); live inventory observed October 1, 2026 at 06:16 UTC.
Status: proposal, not an approved migration. The user subsequently confirmed that the portfolio admin must automate both adding new photos and replacing existing photo edits. No production changes, orders, workflow dispatches, or catalog mutations were made.

## Recommendation

Keep Shopify and Gelato. Use their standard integration to manage products and fulfillment, with a small portfolio-admin bridge for the user's confirmed automation requirements. Give portfolio photos explicit, verified Shopify product links instead of making the portfolio a second full commerce administration system.

One photograph should normally have one Shopify product, with sizes as variants. Start with Fine Art only if that is still the intended range. Posters and framed posters can also be variants of one product; dropping framed choices is not a prerequisite for simplification. Canvas and exact Fine Art/frame combinations need a native-template test before promising support.

The initial separate/manual catalog-management proposal was superseded by the user's requirement to automate both new photos and replacement edits from the portfolio admin. The revised direction is a narrowly scoped admin bridge using native templates and exact mappings, not a second full commerce administration system. Replacement support is still an unresolved prerequisite; the native app does not automatically cover the CMS contract.

## What exists

| Layer | Current responsibility | Recommended disposition |
| --- | --- | --- |
| Portfolio CMS | Albums, captions, photo order, per-photo `printEnabled` | Keep; separate desired print eligibility from verified store readiness |
| Google Drive / Cloudinary | Web image delivery; current print generator still uses Cloudinary originals | Keep originals and display setup intact; upload verified print files to Gelato |
| `site.js` | Builds product URLs from album/photo names; supports a small explicit URL override map | Use stable photo ID to verified product URL mapping; no guessed buy links |
| Shopify | Storefront, products, variants, cart, checkout, payments, order record | Keep as commerce source of truth |
| Gelato | Print-file/variant connections, mockups, production, shipping, fulfillment | Keep; prefer native product management |
| `scripts/gelato-products.mjs` | 2,591-line creator/reconciler, polling, metadata/media repair, quarantine, publication, cleanup, strict audit | Retire mutation paths only after native replacement is verified; retain useful read-only checks |
| `scripts/portfolio-print-sync.mjs` | 215-line snapshot/lock/state runner | Replace broad reconciliation with changed-photo jobs; retain needed locking and durable state |
| Admin sync endpoint + GitHub workflow | Credentialed dispatch, serialized jobs, cached state, bounded self-continuations | Keep admin controls; simplify the worker after native update capabilities are proven |
| Theme consolidation override | 356-line client-side hiding/deduplication, title and image-gallery fixes | Remove catalog hiding after underlying listings are clean; keep only proven presentation needs |

Shipping profiles, payment settings, taxes, app connection health, and live installed theme contents were not fully verified in this review. Repository descriptions are not proof those settings are correct in production.

## Verified state and important contradictions

1. Public CMS: revision **187**, 246 photos, **176** item-level `printEnabled: true` photos. Raw response SHA-256: `c42c90be7c8ffc77cc4e0e9b4f1b3487b61065a61b4cddb43cbe9de3e3266db0`.
2. Gelato store listing: **48** unique products, all reported active, all with Shopify external IDs: **16 Fine Art + 16 Framed + 16 Canvas**. Eight GETs across creation/update time in both directions yielded two identical ID-set sweeps; all pages were terminal. This is a converged listing, not individual historical-ID verification.
3. Listed Fine Art products cover **12** enabled CMS photos. Four refer to now-disabled photos: `the-natural-world-3`, `the-natural-world-5`, `the-natural-world-9`, `the-natural-world-13`. **164** enabled photos lack a Fine Art entry in this listing; that does not establish absence everywhere.
4. Local state records **184** active Gelato IDs; **all 184 are absent from the converged remote listing**. Do not infer deletion, create replacements, or delete records until exact IDs, store/account identity, and Shopify mappings are resolved.
5. Public Shopify `/products.json?limit=250` returned HTTP 200 with **zero public products**. This does not prove the Shopify admin contains zero products, nor identify the cause of invisibility.
6. Authenticated Shopify inspection could not start: local client-credentials token exchange returned **HTTP 400**. Admin product status, publication, installed app scopes, and full inventory remain unverified. Gelato `active` is not equivalent to Shopify ACTIVE or Online Store publication.
7. Git `main` HEAD is `31238735c536bc02807f6497cbc8956948859ca2`. Its committed generator still defaults to **three formats** (`edge-to-edge-v1`). The uncommitted working copy and docs describe **Fine Art only** (`fine-art-mockup-v2`). This simplification is not an established deployed catalog contract. Existing dirty changes were preserved.
8. Latest inspected [shop-sync run](https://github.com/atishaycn/c_portfolio/actions/runs/32893746159), started August 25, failed with deferred asynchronous Shopify media repairs after publishing work across three formats. No active run was observed. Historical publication-scope errors are not proof of the current failure.

If all 176 enabled photos remain in the shop, one product/photo means **176 products**. At three sizes each, that is **528 variants**, not 528 separate product listings. Actual size availability and crops need validation.

## Why complexity accumulated

The code treated the CMS as the complete commerce catalog authority, generating multiple separate products for each photo. That expanded into managing asynchronous publishing, API scopes, media processing, inventory discovery, retries, interrupted state, duplicate prevention, and orphan recovery.

The storefront then needed a second layer to hide duplicate/formatted product cards and repair previews. Client-side hiding cannot repair Shopify's underlying inventory, publication, collection counts, pagination, or exports.

These safeguards address real risks in a custom writer; deleting safeguards while leaving the writer running would be regression, not simplification. The bigger simplification is to stop owning that lifecycle when the native integration already owns it. The reviewed evidence establishes this layering, not the historical intent behind every change.

## Native capabilities already available

- [Gelato's basic Shopify integration is included in its free account](https://support.gelato.com/en/articles/8996080-how-much-does-gelato-cost). Existing Shopify fees and production/shipping charges still apply; this is not a completely free store.
- [Gelato supports posters and framed posters in one product](https://support.gelato.com/en/articles/8996199-how-can-i-add-framed-posters-and-posters-to-the-same-product). Mixed-type products have editing/duplication limitations; validate the proposed template rather than assuming all categories behave identically.
- [Native template-based CSV bulk creation](https://support.gelato.com/en/articles/10506835-how-to-create-products-in-bulk-using-templates) can replace much custom generation. Check feature availability in this account first. Bulk creation changes live listings; inventory reconciliation and a small pilot must precede it.
- [Existing variants can be connected in bulk](https://support.gelato.com/en/articles/10485420-can-i-connect-and-create-variants-in-bulk), avoiding a default delete-and-recreate migration.
- [Shopify supports variant-assigned images](https://help.shopify.com/en/manual/products/product-media/add-images-variants). A deliberately filtered gallery may still require small theme work, but wholesale catalog hiding does not follow from native size options.
- [Connected Shopify orders are imported by Gelato](https://support.gelato.com/en/articles/8996418-how-can-i-import-orders-from-shopify). No separate order fulfillment service needs to be built here.
- [Google Drive is not supported for Gelato's documented bulk migration print-file URLs](https://support.gelato.com/en/articles/8996417-how-can-i-move-my-shopify-products-to-gelato-in-bulk). Use verified print-ready uploads or supported direct file URLs; portfolio display images and manufacturing files are different concerns.

## Proposed cleanup sequence — not executed

1. Preserve the confirmed requirement: admin automation for both new photos and replacement edits. Resolve replacement API versus native CSV upload, and confirm desired formats; do not silently remove framed/canvas offerings.
2. Resolve Shopify authentication and the 184-ID discrepancy. Export exact product, variant, fulfillment connection, publication, and source-photo mappings. Preserve existing usable product IDs/URLs and order history.
3. Build or repair one hidden native product using a verified original. Check crop, orientation, size, price, mockup, shipping profile, and Gelato variant connection. Inspect desktop/mobile and cart; do not place a paid order.
4. Validate portrait, landscape, and square cases. If suitable, use native reconnect/import operations or a small CSV exporter to expand only the approved photo set. Keep one catalog writer; never run native bulk creation alongside the old reconciler.
5. Map each stable CMS photo ID to its confirmed Shopify URL. Show an order link only when the listing and fulfillment connection have been verified. Renaming albums must not change product identity.
6. Publish verified products through Shopify's normal controls, then check public collections, direct links, size/image selection, cart, and mobile. A visually present card is not fulfillment proof.
7. Once replacement behavior passes, reversibly archive obsolete exact-mapped listings where permitted. Remove the old theme's catalog hiding and obsolete broad-reconciliation paths, secrets, and docs. Retain admin controls, the replacement worker's safety mechanisms, shared CMS/image functionality, and useful read-only audits.

## Decision frontier

- **Confirmed:** portfolio admin remains the control panel; automation must cover both new photos and revised image files for existing photos.
- **Update capability:** public [Gelato Ecommerce API docs](https://dashboard.gelato.com/docs/ecommerce/products/create-from-template/) document template creation plus get/list, but no existing-product artwork-replacement endpoint was found. This does not establish that partner/private support is unavailable.
- **Native existing-product path:** [connected Shopify designs can be edited in Gelato](https://support.gelato.com/en/articles/8996424-how-do-i-edit-my-existing-shopify-products-connected-to-gelato); [bulk print-file replacement uses dashboard CSV](https://support.gelato.com/en/articles/10615769-bulk-update-product-designs-and-mockups). A script could prepare that batch, but dashboard upload would still be a manual step unless a supported programmatic method is confirmed. Google Drive print-file URLs are not supported in this bulk process.
- **Identity/safety:** native docs do not explicitly guarantee preserved Shopify product/variant IDs and URLs, draft-only staging, or rollback for a replacement. Verify all these in a controlled pilot. Updating a storefront preview is not proof of updating the manufacturing file. Order PATCH endpoints are not product-design update endpoints.
- **Open choice:** accept one native CSV upload per replacement batch, or require a supported API before proceeding with fully automatic replacements?
- **Range:** Fine Art only initially or preserve additional formats from the start? Still undecided.

The ask-matt review flow waits for these choices before implementation. No catalog migration is approved by this document.
