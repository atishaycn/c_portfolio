# Shared Operator Instructions

## Private / Shared Policy

- Keep durable project instructions, specs, plans and the main project index in this partition, tracked in Git on `main`.
- Never commit credentials, tokens, `.env*` files, `.admin-credentials.local.json`, `.drive-migration.local/` or `.vercel/`. Example files hold placeholders only.

## CEO thread

- One T3 thread is the CEO/CTO of this project (Claire Thomas Art, clairethomas.art). It plans, reviews, keeps the brain and `plans/work-board.md` current, and owns branches. Other threads do focused work; when one finishes or stalls, the CEO records its outcome on the work board and saves its code on its branch.
- Read `product/portfolio-site.md` and `plans/work-board.md` before planning or starting any workstream.

## Branches and worktrees

- clairethomas.art is served by the Cloudflare Worker `clairethomas-site`, deployed by hand from a clean `infra/cloudflare` worktree (`npm run build:cf`, then `wrangler deploy`; see `plans/cloudflare-migration.md`). `main` has no Worker config until that branch merges. Vercel still builds every push to `main` but serves only its own `vercel.app` address until it is disconnected.
- Deploy the Worker, or push site changes to `main`, only after the user approves the release. Brain-only commits (`.operator-shared/`) may go to `main` at any time. Merge `main` into `infra/cloudflare` so a release carries fixes made on `main`.
- One branch per workstream, cut from `main`, named `<area>/<slug>` (`ui/`, `drive/`, `shop/`, `feature/`, `admin/`). Parallel workstreams each get their own worktree at `~/Developer/c_portfolio-<slug>`; never run two agents in one worktree.
- Never leave work uncommitted between sessions. Commit WIP on the workstream branch and push it, so GitHub holds every unfinished line of work.
- After a branch merges into `main`, delete it locally and on GitHub, and remove its worktree. Rebase or merge `main` into long-lived branches before resuming them.
- Run `npm run check` before every commit that touches code.

## Delegation

- Hands-on work goes to child tasks via T3 `delegate_task` with provider `codex`, model `gpt-6-luna`, `reasoningEffort: max`, `serviceTier: priority` (Fast). If Codex is unavailable, stop and ask the user.
- One child per workstream and worktree; never two children on the same worktree. Each brief names the branch, worktree, brain docs to read, and the done check.
- GPT-6 Luna needs babysitting. Keep briefs small and explicit, poll until done, and never trust its report: re-run `npm run check`, read the diff, and drive the real page. Reject work that skips the brief, invents results, touches other workstreams, or leaks secrets. Verify before reporting to the user.

## Release safety

- Never deploy (wrangler or the Vercel CLI) from a dirty or mixed checkout; both upload the folder, not the commit. Commit and push first, then deploy from that clean worktree. Keep `.vercelignore` an allowlist (see `specs/release-and-security.md`).
- UI changes: check desktop and a 390px phone viewport, with no console errors, before calling them done.
