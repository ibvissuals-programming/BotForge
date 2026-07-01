---
name: inject-og worf domain bug
description: REPLIT_DEV_DOMAIN in Replit build containers is a worf tunnel, not the public deployment domain — must be filtered in inject-og.mjs
---

## Rule

In `inject-og.mjs`, never use `REPLIT_DEV_DOMAIN` as the `BASE_URL` when it
contains `.worf.replit.dev`. That domain is an internal Replit tunnel injected
into build containers; it is unreachable by external scrapers (WhatsApp, etc.).

## Why

During `[services.production.build]`, Replit injects `REPLIT_DEV_DOMAIN` set
to the build container's own worf tunnel (e.g.
`301d0e45-…-00-37z3dcpzl3rkn.worf.replit.dev`). This is NOT the public
deployment domain (e.g. `bot-forge--ib-build.replit.app`). If used, og:image
URLs are baked in pointing to the worf domain, which WhatsApp's link-preview
scraper cannot reach — OG images appear missing on share.

## How to apply

The resolution order in `inject-og.mjs` must be:
1. `VITE_PUBLIC_URL` (explicit override — set in artifact.toml build env or as a secret)
2. `REPLIT_DEV_DOMAIN` **only if** `!domain.includes('.worf.replit.dev')` (i.e. a real public domain)
3. Hardcoded fallback — the known production deployment domain (`bot-forge--ib-build.replit.app`).
   **Update this fallback** whenever the app is re-deployed to a new Replit instance.

The hardcoded fallback fires in all build-container scenarios because
`REPLIT_DEV_DOMAIN` is always a worf domain there.

## Confirmed

- Old fallback `bot-forge--xcoderib.replit.app` was never reached because
  `REPLIT_DEV_DOMAIN` IS set in the build container — just to the wrong value.
- `/og/rossy.jpg` IS accessible on the production domain (HTTP 200); only the
  URL baked into og:image was wrong.
- Fix: filter added + fallback updated to `bot-forge--ib-build.replit.app`.
