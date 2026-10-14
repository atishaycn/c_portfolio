# Shared Partition Catalog

## Tree

- `operator.md`
  - Description: Operator Instructions for this partition.
  - Read If: Auto-injected.
- `catalog.md`
  - Description: This catalog.
  - Read If: Auto-injected.
- `../GLOSSARY.md`
  - Description: The project's ubiquitous language: the domain terms for the portfolio, booking, Shop, and client intake.
  - Read If: Naming things, writing user-facing text, or re-explaining a message with `/wait-what`.

### `product/` - Business and product intent

- `portfolio-site.md`
  - Description: Charter for clairethomas.art: goals, users, external services and accounts, where each concern lives, and settled product decisions.
  - Read If: Planning any work on the site, adding a service, or deciding where new work goes.

### `plans/` - Live work tracking

- `work-board.md`
  - Description: Every open workstream with its branch, worktree, status and next step; open loose ends; archived branches.
  - Read If: Starting a session, picking up or finishing any workstream, or asked "what's open".

### `research/` - Cited findings

- `pixieset-build-vs-buy.md`
  - Description: Pixieset features and prices mapped to what our site has, build effort per feature, our stack's running cost, and the build-or-buy recommendation.
  - Read If: Planning client galleries, invoices, contracts, booking tools or any Pixieset-like feature, or choosing a photography business platform.

- `hosting-and-images.md`
  - Description: Cost and work to move hosting from Vercel to Cloudflare Workers and images from Cloudinary to R2 with Cloudflare transformations; current Cloudinary usage; recommendation and triggers.
  - Read If: Changing hosting, image storage or delivery, DNS provider, or when Cloudinary credits run high.

### `specs/` - System contracts

- `release-and-security.md`
  - Description: How code reaches production, the `.vercelignore` allowlist invariant, preview vs production environments, rollback, and the credential exposure history.
  - Read If: Deploying, changing build/output config, adding files at the repo root, or handling secrets.
- `booking-inquiry.md`
  - Description: Booking page and `/api/inquiry` contract: form fields, validation, spam handling, Resend delivery and fallback.
  - Read If: Changing the Booking page, the contact form, or email sending.
- `shop-checkout.md`
  - Description: Cart to Stripe payment to Gelato order: server-side pricing, photo size check, print file, test-mode guard, shipping sample, webhook plan.
  - Read If: Building or changing checkout, payment, order handling, or anything that sends an order to Gelato.
- `shop-admin.md`
  - Description: Admin shop settings (markup, shipping rates) and the Orders tab: approve, cancel with refund, edit crop and same-price options.
  - Read If: Changing shop settings, order review, or any admin endpoint that moves money.
- `site-design.md`
  - Description: Public site navigation, homepage, section pages and colour decisions the user settled.
  - Read If: Changing any public page layout, navigation or styling.
- `shop-store.md`
  - Description: Shop page store contract: v1 scope, screens (store home, product page, photo picker, customize, cart), live CSS mockup rules, style.
  - Read If: Working on the Shop/prints page, print products, mockups or cart.
