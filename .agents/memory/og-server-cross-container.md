---
name: og-server cross-container localhost bug
description: og-server.mjs calling localhost:8080 fails in production because chatbot and api-server run in separate autoscale containers. Fix: directory-index fallback in og-server.mjs serves inject-og.mjs pre-built HTML instead.
---

# OG Server Cross-Container Localhost Bug

## The Rule
og-server.mjs must never rely on `localhost:8080` for runtime data in production. The chatbot artifact and api-server artifact run in **separate containers** in Replit Autoscale. `localhost:8080` from the chatbot container is unreachable.

**Why:** Replit Autoscale deploys each artifact as an independent service. Path-based routing (`/` → chatbot:3000, `/api` → api-server:8080) is handled by Replit's reverse proxy, not by co-location. The internal `localhost` of the chatbot container has nothing on port 8080.

**How to apply:** Any server-side logic in og-server.mjs that needs business data must either:
- Use the pre-built static output from inject-og.mjs (directory-index fallback — current fix), OR
- Query the DB directly via `DATABASE_URL` (injected into all containers)

Never add `http://localhost:8080` calls back to og-server.mjs.

## The Fix (applied)

**Fix A — og-server.mjs** (load-bearing): Added directory-index fallback between the exact-file check and the scraper-cache logic:
```js
const dirIndexPath = path.join(DIST, pathname, "index.html");
if (tryServeFile(res, dirIndexPath)) return;
```
This serves `dist/public/rossyevents/index.html` (the inject-og.mjs output) for `/rossyevents`, bypassing the localhost:8080 call entirely.

**Fix B — inject-og.mjs** (resilience): BASE_URL now resolves from env instead of hardcoded domain:
```js
const BASE_URL =
  process.env.VITE_PUBLIC_URL ||
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://bot-forge--xcoderib.replit.app");
```

## How the OG pipeline works (current state)

1. **Build time** (`inject-og.mjs`): Creates `dist/public/<slug>/index.html` for each business with correct absolute og:image URLs. Hardcoded business list — must be updated when onboarding new clients.
2. **Runtime** (`og-server.mjs`): 
   - Exact static file match → serves it
   - Directory-index fallback (`/<slug>/index.html`) → serves pre-built OG HTML ← **this is the OG fix**
   - Scraper UA fallback → calls localhost:8080 (works in dev, fails silently in prod — now irrelevant for known slugs)
   - SPA fallback → serves base `index.html`

## Pre-publish check 9

Added check 9 to `scripts/src/pre-publish-check.ts`: spawns og-server.mjs on port 3099 against `dist/public/`, fetches each slug with a WhatsApp UA, asserts og:image is present and contains the correct filename. This is the test that would have caught this bug on day one.

## Symptom when broken

WhatsApp link preview shows the admin-login screenshot instead of the business image. Root cause chain: localhost:8080 unreachable → empty businessCache → biz undefined → serveIndex → base index.html (no og:image tag) → WhatsApp screenshots the page instead.
