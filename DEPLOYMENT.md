# BotForge — Deployment Guide & Production Gotchas

> Captures every production issue found and fixed in the June 2026 session.
> Read this before deploying or reimporting the project.

---

## Required Secrets

All three must be present in **Deployments → Secrets** (not just dev Secrets).

| Secret | Purpose | How to get |
|---|---|---|
| `GROQ_API_KEY` | AI chat + promo content generation | [console.groq.com](https://console.groq.com) → API Keys (free) |
| `BOTFORGE_CEO_PASSWORD` | Admin dashboard password gate | Set any strong password |
| `DATABASE_URL` | PostgreSQL — leads + businesses | See "Database" section below |

Run `pnpm run secrets:check` at any time to validate all three. It exits 0 only when all secrets are present **and** the database hostname is safe for production.

---

## Database

### Dev vs. Production DATABASE_URL — Critical Difference

Replit's PostgreSQL integration automatically sets `DATABASE_URL` in the **dev environment** using an internal container hostname (`helium`, resolving to `172.24.0.3`). This hostname:

- **Works in dev** — it exists inside the dev container's private network
- **Breaks in production** — the production container runs in a separate network namespace where `helium` does not resolve; TCP SYN packets are silently dropped

**Symptom if wrong:** "Built successfully but failed to start" — the server hangs for ~60 seconds waiting for a TCP handshake that never completes, then the deployment timeout kills it with no useful error.

**Fix:** Set `DATABASE_URL` in **Deployments → Secrets** using the **external** connection string from the PostgreSQL integration — it will have a public FQDN (e.g. `ep-xyz.us-east-1.aws.neon.tech`) rather than `helium`.

### Self-Diagnosing Guards

Two layers catch this automatically:

1. **Pre-deploy build gate** (`artifact.toml`) — `pnpm run secrets:check` runs before the production build. If the hostname is internal-only, the build aborts immediately with a clear message instead of letting a broken deploy through.

2. **Server boot warning** (`lib/secrets-check.ts`) — on every startup, `runSecretsCheck()` inspects the `DATABASE_URL` hostname and logs a `WARN` block if it's internal. The server still boots in dev (where `helium` is reachable); only a warning is logged.

### Hostname Detection Heuristics

The guard flags any of:
- Known Replit dev aliases: `helium`, `neon-proxy`, `db`, `postgres`, `database`
- Single-label hostname with no dots — can never be a real FQDN
- Loopback addresses: `localhost`, `127.0.0.1`, `::1`
- RFC-1918 private IPs: `10.x`, `172.16–31.x`, `192.168.x` (flagged in production only)

A correct production URL with a dotted public FQDN passes silently.

---

## connect_timeout Fix

### Problem

`pg.Pool`'s `connectionTimeoutMillis` option controls how long to wait for an **idle client from the pool queue** — it is **not** a TCP socket connection timeout. When the DB host is unreachable and silently drops SYN packets, `connectionTimeoutMillis` never fires. The pool hangs at the OS TCP layer until the deployment kills the process (~60 seconds).

### Fix Applied

All three locations that create a `pg.Pool` now append `connect_timeout=15` (or `connect_timeout=5` for the health ping) to the connection URL before passing it to the pool. This is a PostgreSQL protocol-level parameter that instructs `libpq` to abort the TCP handshake after N seconds.

```ts
// Pattern used in db-migrate.ts, routes/leads.ts, routes/health.ts
const dbUrlWithTimeout = dbUrl.includes("?")
  ? `${dbUrl}&connect_timeout=15`
  : `${dbUrl}?connect_timeout=15`;
const pool = new Pool({ connectionString: dbUrlWithTimeout, ... });
```

**Effect with a bad hostname:** fails in ~15 seconds with a clear timeout error + `process.exit(1)`, instead of hanging silently for 60 seconds. Combined with the pre-deploy hostname guard, this situation should never reach production in the first place.

---

## Schema & Migrations

Migrations run automatically on every server boot (`index.ts` calls `runMigrations()` before `app.listen()`). They are fully idempotent:

- `CREATE TABLE IF NOT EXISTS businesses`
- `CREATE TABLE IF NOT EXISTS leads`
- `ALTER TABLE leads ADD COLUMN IF NOT EXISTS contacted BOOLEAN NOT NULL DEFAULT FALSE`
- Seeds "Styled By Fortune" only when `businesses` table is completely empty

If migrations fail (e.g. bad `DATABASE_URL`), the server exits with code 1 before binding to port 8080, so the deployment healthcheck never passes.

---

## Pre-Deploy Checklist

Run through this before every deployment attempt:

```
pnpm run secrets:check
```

Expected output for a ready-to-deploy state:
```
  ✅  GROQ_API_KEY
  ✅  BOTFORGE_CEO_PASSWORD
  ✅  DATABASE_URL
  All secrets present — server fully operational ✅
```

If you see `⚠️  DATABASE_URL HOSTNAME WARNING` — stop, set the correct external `DATABASE_URL` in Deployments → Secrets, then re-run the check before deploying.

---

## Disabled Files

| File | Status | Notes |
|---|---|---|
| `lib/db/drizzle.config.ts.disabled` | Disabled (intentional) | Left from an earlier Drizzle ORM experiment. The project uses raw `pg` queries, not Drizzle. Do not re-enable. |

---

## Architecture Quick Reference

| Artifact | Port (dev) | Production |
|---|---|---|
| `api-server` | 8080 | Node.js process, `node --enable-source-maps artifacts/api-server/dist/index.mjs` |
| `chatbot` | 3000 | Static files, served from `artifacts/chatbot/dist/public` |

The chatbot was migrated from port 22967 → 3000 (22967 is not in Replit's supported preview port list). This only affects the dev workflow; production serves the chatbot as static files with no runtime process.
