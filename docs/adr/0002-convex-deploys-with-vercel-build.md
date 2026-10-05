# 2. Convex deploys inside the Vercel production build

Date: 2026-10-04
Status: accepted

## Context

Pushing `main` deploys clairethomas.art to production. Branches get Vercel previews. The site has no build step. Convex has a dev and a prod deployment.

## Decision

- Vercel Production builds run `npx convex deploy` with a production deploy key (`CONVEX_DEPLOY_KEY`, Production env only), so Convex prod changes exactly when `main` ships.
- Vercel Preview and local development use the Convex **dev** deployment, kept current by `npx convex dev`.
- No per-branch Convex preview deployments.

## Consequences

- The site and its Convex functions cannot drift apart in production.
- The project gains a build command; static files are still served unchanged.
- All previews share dev data, so a schema change on one branch affects other previews.
