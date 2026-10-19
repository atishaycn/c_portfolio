# Test Suite

## Contract

- One command: `npm run check`. It runs `node --check` on `site.js`, `cms-loader.js`, and `admin.js`, then `node --test scripts/*.test.mjs`. The sync workflow (`.github/workflows/portfolio-shop-sync.yml`) runs it before any Gelato or Shopify call, and it must stay that way.
- Tests run offline. Only the network (`fetch`), timers and the clock, and secrets are faked. No test reads `.env*` or touches a real account.
- Fixtures hold no real keys, customer data, or personal addresses. Use `example.test` or `example.com` addresses and `test-*` values. Public storefront and site hostnames are allowed.
- Every fix to the sync, the API, the CMS, or the storefront theme keeps a regression test. A comment above the test names the fix commit: `// Regression: <hash>`. A fix whose code is a Shopify theme file is guarded by `scripts/shopify-theme-consolidation.test.mjs`.
- Known bugs are marked `[xfail]` through the `xfail` helper in `scripts/api-routes.test.mjs`. The test passes while the bug reproduces and fails once it is fixed, which is the signal to remove the marker.
- Request-layer tests (`scripts/gelato-requests.test.mjs`) inject `fetchImpl`, `sleepImpl`, and `AbortSignal.timeout`. Keep new request logic behind the same seams.

## Known gaps (no offline seam)

- `site.js` and `admin.js` behaviour in the browser (lightbox, layout, mockups). No DOM test harness exists.
- The Gelato sync `run()` loop in `scripts/gelato-products.mjs` is not exported.
- One-off or state-changing scripts: `create-admin-credentials.mjs`, `configure-vercel-admin-env.mjs`, `capture-shopify-credential.mjs`, `export-portfolio-content.mjs`, `seed-portfolio-content.mjs`, and the `upload-*.sh` helpers.
- Timing constants that a test cannot observe without real time: the 3-hour publishing deadline is now only a ceiling behind the 1-hour stall window (tested).
