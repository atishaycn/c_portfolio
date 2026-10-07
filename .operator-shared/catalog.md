# Shared Partition Catalog

## Tree

- `operator.md`
  - Description: Operator Instructions for this partition.
  - Read If: Auto-injected.
- `catalog.md`
  - Description: This catalog.
  - Read If: Auto-injected.

### `product/` - Business and product intent

- `portfolio-site.md`
  - Description: Charter for clairethomas.art: goals, users, external services and accounts, where each concern lives, and settled product decisions.
  - Read If: Planning any work on the site, adding a service, or deciding where new work goes.

### `plans/` - Live work tracking

- `work-board.md`
  - Description: Every open workstream with its branch, worktree, status and next step; open loose ends; archived branches.
  - Read If: Starting a session, picking up or finishing any workstream, or asked "what's open".

### `specs/` - System contracts

- `release-and-security.md`
  - Description: How code reaches production, the `.vercelignore` allowlist invariant, preview vs production environments, rollback, and the credential exposure history.
  - Read If: Deploying, changing build/output config, adding files at the repo root, or handling secrets.
- `booking-inquiry.md`
  - Description: Booking page and `/api/inquiry` contract: form fields, validation, spam handling, Resend delivery and fallback.
  - Read If: Changing the Booking page, the contact form, or email sending.
- `site-design.md`
  - Description: Public site navigation, homepage, section pages and colour decisions the user settled.
  - Read If: Changing any public page layout, navigation or styling.
- `shop-store.md`
  - Description: Shop page store contract: v1 scope, screens (store home, product page, photo picker, customize, cart), live CSS mockup rules, style.
  - Read If: Working on the Shop/prints page, print products, mockups or cart.
