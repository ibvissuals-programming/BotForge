---
name: artifact.toml env var section name
description: The only recognised section for injecting env vars into the production run process is [services.env] — any other name is silently ignored.
---

## Rule

Use `[services.env]` to set env vars (PORT, NODE_ENV, etc.) that must reach the production run process. No other section name works.

**Why:** Replit's artifact.toml schema only recognises `[services.env]` for this purpose. A section named `[services.production.run.env]` is silently ignored — no parse error, no warning. PORT is never set, the server throws before `app.listen()`, and the deployment fails with "not all artifact ports opened" / SIGTERM. The build log shows green because the failure is runtime-only.

**How to apply:** Any time env vars need to reach a production Node.js process (PORT, NODE_ENV, etc.), they go in `[services.env]`. Confirmed working pattern from BotForge api-server (June 2026).

**Dev override:** `[services.env]` applies to all environments. If NODE_ENV="production" is set there, the dev script can override it with `export NODE_ENV=development` in the shell command — the shell export wins.

**Verification:** Grep for `[services.production.run.env]` — it must not exist in any artifact.toml.
