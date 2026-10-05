# 1. Convex sits behind Vercel functions

Date: 2026-10-04
Status: accepted

## Context

The client intake needs a database (Convex). The site is plain HTML/JS with no build step. Claire already has one admin login: a password checked in a Vercel function that sets a signed `ct_admin` cookie. Admin pages carry a strict CSP (`connect-src 'self'` plus Cloudinary).

## Decision

Browsers never call Convex. All reads and writes go through Vercel functions under `/api/`:

- Admin actions use the existing `requireSession` check, then call Convex.
- The client page sends its intake link token to `/api/intake/...`; the function calls Convex with the token.
- Every Convex function exposed to Vercel checks a shared server secret (env var on both sides). Client-facing functions also check the link token.

## Consequences

- One login for Claire; no Convex Auth.
- No Convex client library in the browser, no build step, CSPs unchanged.
- No live updates in the browser; pages fetch on load and after each action.
- One extra network hop per request.
- Reversing this (browser → Convex) would need Convex Auth and a CSP change.
