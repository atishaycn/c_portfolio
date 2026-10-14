# Release and Security

## How code reaches production

- Push to `main` → Vercel builds and releases clairethomas.art. This is the normal release path; it deploys the commit, not the local folder.
- Pushing any other branch creates a login-protected Preview deployment. Production env vars (Cloudinary, admin) are not set for Preview by default, so preview galleries show the bundled fallback content (`content/portfolio.json`), not live albums. Judge layout on previews, not photos.
- Rollback: `vercel rollback`, or promote the previous deployment in the Vercel dashboard.

## Invariants

- `.vercelignore` is an allowlist (`/*` then `!` the served paths). Anything new at the repo root is private by default. Never turn it into a denylist.
- After any build or output change, confirm on the deployment that `/.admin-credentials.local.json`, `/.env`, `/node_modules/…` and backend source return 404.
- `feature/client-intake` adds a build step that copies only public files into `public/`. When it merges, that becomes the production output contract and replaces the allowlist as the main guard; keep both until verified on production.
- Secrets go to Vercel or Convex through their CLIs without printing values. Never paste a secret in chat.

## Admin sign-in (email link, from the Cloudflare move)

- Decided by the user on 2026-10-14: no admin password. Claire enters her email; only `ADMIN_EMAIL` gets a sign-in link (through Resend), and the page answers the same for any email.
- The link carries a signed token in the URL fragment (`/admin.html#login=…`), so mail scanners that prefetch links cannot use it; the page posts the token to the server, which sets the usual 7-day `ct_admin` session cookie. A token expires within about 30 minutes.
- Sending is capped by a Resend idempotency key per 15-minute window, so at most one email per window however often the form is used; a second request in the window sends nothing and the first link still works.
- The check costs well under Cloudflare Free's 10 ms CPU per request (scrypt took about 45 ms). It also retires the leaked password below; the session secret is still rotated at the cutover.

## Exposure history (open)

- Before 2026-10-03, CLI deploys from the working folder shipped `.admin-credentials.local.json` (admin email and plaintext password). Affected deployments: a 2026-10-03 preview, production `5lou8gc58` (live for minutes), and production `7hi13iqe8` (~2026-09-20). Open actions: rotate the admin password and session secret, delete those three deployments. Tracked on the work board.
