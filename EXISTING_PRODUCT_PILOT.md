# Existing-product pilot

## Goal and boundary

Before choosing or deploying new-photo-only admin automation, prove one existing print end to end. No catalog-wide writer, paid order, altered print file, or publishing an incomplete product. The offline new-photo planner is not integrated with admin or deployed.

## Evidence — September 30, 2026 (Pacific)

- Authoritative CMS: revision 187; raw SHA-256 `c42c90be7c8ffc77cc4e0e9b4f1b3487b61065a61b4cddb43cbe9de3e3266db0`.
- First visible natural-world photograph is stable ID `the-natural-world-2`, not ID 1. Source `2_gaxjez`, 5184×3456, item-level `printEnabled: true`.
- Chrome: photograph/lightbox loads and its Order print anchor resolves `https://shop.clairethomas.art/products/the-natural-world-2-fine-art-print`. The click first opened the homepage; navigating the exact anchor destination explicitly showed **Page not found**.
- Exact authenticated Shopify admin product `10549112668344`: **Draft**, **not published anywhere**, empty Media area. Identity tags include `photo-id:the-natural-world-2`, `format-fine-art`, `catalog-edge-to-edge-v1` and `claire-thomas`.
- Exact Gelato product GET `3799c2e0-f443-417f-9200-fe54392fa0c3`: same Shopify product ID, `active`, three connected variants, zero `productImages`, null preview/thumbnail. Gelato active is not Shopify publication proof.
- Intended CMS print-source URL returned HTTP 200 JPEG (2,693,003 bytes). This verifies source availability, **not the artwork actually attached to Gelato's fulfillment design**; that remains unverified.

| Size | Gelato variant / matching Shopify SKU | Gelato-reported Shopify ID | Actual Shopify size/SKU ID | Draft preview price |
| --- | --- | --- | --- | --- |
| 8×12 | `c398d939-0242-4277-8a22-503a77bd35da` | `53977525092536` | `53977525158072` | $37.79 USD |
| 12×18 | `77311a92-42b7-4e2f-8885-dc942ed62c65` | `53977525158072` | `53977525125304` | $48.09 USD |
| 16×24 | `0c8093ea-3886-4045-93a3-552f040c386f` | `53977525125304` | `53977525092536` | $51.72 USD |

### Follow-up: exact-ID disagreement

Authenticated Shopify's expanded variant rows show that **all three Gelato `externalId` values disagree with Shopify's actual size/SKU pairings**. The initial API-only ID table was not a verified cross-system mapping; the table above preserves both observations rather than treating Gelato IDs as authoritative. Shopify SKUs equal the correct same-size Gelato variant IDs. Whether Gelato fulfills by SKU or its discrepant external IDs remains unproven. Do not publish or place an order until native connection/design inspection resolves this.

The exact Shopify detail page `/store/esf4bj-wk/products/10549112668344/variants/53977525092536` independently shows 16×24, $51.72, Draft, no image; the product row exposes full SKU `0c8093ea-3886-4045-93a3-552f040c386f`. The 12×18 and 8×12 native detail links likewise use the actual IDs in the table.

- Native Shopify draft preview: all three selections observed, with the corresponding price/size changing. No product imagery exists. Private preview key omitted from this report.
- Chrome DevTools phone emulation: 390×844, mobile and touch enabled. Portfolio lightbox and Order print link fit; document width equals viewport width (390). Exact public product page also fits but shows 404.
- Portfolio console: no captured warnings/errors. Shop console has Shopify telemetry fetch errors; no evidence these cause the unpublished-product 404.
- Local Shopify client-credentials exchange: HTTP 400 HTML, no token. Browser Shopify admin access works. Current publication scopes were not verified; do not describe the historical ACCESS_DENIED as the current cause.
- Gelato dashboard inspection was initially interrupted by Chrome's extension-UI blocker. On continuation, the dashboard shows the native Gelato login form with empty Email/Password inputs. No credentials were entered; user sign-in is required to inspect actual fulfillment artwork/design.

## Artifacts and remaining acceptance checks

- Redacted API evidence: `/tmp/claire-existing-product-pilot-gelato.json`.
- Screenshots: `/tmp/claire-existing-product-pilot/mobile-portfolio.jpg`, `/tmp/claire-existing-product-pilot/mobile-shop-404.jpg`.
- Follow-up screenshots: `/tmp/claire-existing-product-pilot/shopify-16x24-variant.jpg`, `/tmp/claire-existing-product-pilot/gelato-login.jpg`.
- Still required: inspect the actual Gelato print design/placement; restore correct mockups/media for **only this existing product**, if specifically authorized; verify all three Shopify variant bindings; publish only after safety checks and authorization; test desktop/mobile public size selection and cart. No order required.
- No cart addition or checkout performed. No remote product changes, workflow dispatch, commit, push, or deployment performed.
- Pilot **has not passed**. Architecture decisions and further automation integration remain deferred.
- Third goal-turn recheck, `2026-10-01T06:58:14Z`: native Gelato still shows empty sign-in inputs; authenticated Shopify still shows Draft. A direct HTTP fetch of the canonical product URL redirects to the homepage (HTTP 200 final response), unlike Chrome's previously observed product-path 404. Neither response provides a buyable public product. The same dependency remains: user Gelato sign-in plus explicit single-product repair/publication authorization. No safe remaining check can prove the actual attached print design or public cart without those changes; do not repeat catalog-wide retries.
