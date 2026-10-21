# Release and Security

## How code reaches production

- Since 2026-10-17 clairethomas.art and `www` are served by the Cloudflare Worker `clairethomas-site` (custom domains; zone on Cloudflare DNS, nameservers `carioca`/`lennox`). Release: from a clean checkout of the release branch, `npm run build:cf && npx wrangler deploy` (token in the git-ignored `.env.cloudflare.local`). It uploads the built `dist/` from the allowlist, so a dirty checkout must never deploy. A push to `main` no longer releases anything.
- The workers.dev address (`clairethomas-site.phunnysunny.workers.dev`) is the same Worker: the place to test, and the only host where the Shop is open (`SHOP_OPEN_HOSTS`).
- Rollback: `npx wrangler rollback` to the previous Worker version.
- Vercel project `c-portfolio` is kept connected until a day after the cutover as a fallback, then disconnected.

## Invariants

- `.vercelignore` is an allowlist (`/*` then `!` the served paths). Anything new at the repo root is private by default. Never turn it into a denylist.
- After any build or output change, confirm on the deployment that `/.admin-credentials.local.json`, `/.env`, `/node_modules/…` and backend source return 404.
- `feature/client-intake` adds a build step that copies only public files into `public/`. When it merges, that becomes the production output contract and replaces the allowlist as the main guard; keep both until verified on production.
- Secrets go to the Worker (`wrangler secret put`/`bulk`) or Convex through their CLIs without printing values. The production `ADMIN_SESSION_SECRET` (new at the cutover) is in the worktree's git-ignored `.env.cloudflare-prod.local`. Never paste a secret in chat.

## Admin sign-in (email link, from the Cloudflare move)

- Decided by the user on 2026-10-14: no admin password. Claire enters her email; only an address listed in `ADMIN_EMAIL` (comma-separated) gets a sign-in link, sent to that address (through Resend), and the page answers the same for any email. A session is valid only while its address is still listed.
- The link's address comes from `ADMIN_SITE_URL` (set per deployment), never from the request's Host header; without it, links are sent only for localhost.
- The link carries a signed token in the URL fragment (`/admin.html#login=…`), so mail scanners that prefetch links cannot use it; the page posts the token to the server, which sets the usual 7-day `ct_admin` session cookie. A token expires within about 30 minutes.
- Sending is capped by a Resend idempotency key per 15-minute window, so at most one email per window however often the form is used; a second request in the window sends nothing and the first link still works.
- The check costs well under Cloudflare Free's 10 ms CPU per request (scrypt took about 45 ms). It also retires the leaked password below; the session secret was rotated at the cutover (2026-10-17).

## Exposure history (open)

- Before 2026-10-03, CLI deploys from the working folder shipped `.admin-credentials.local.json` (admin email and plaintext password). Affected deployments: a 2026-10-03 preview, production `5lou8gc58` (live for minutes), and production `7hi13iqe8` (~2026-09-20). Open actions: rotate the admin password and session secret, delete those three deployments. Tracked on the work board.
