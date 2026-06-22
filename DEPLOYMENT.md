# BotForge — Deployment Guide & Production Gotchas

> Captures every production issue found and fixed in the June 2026 session.
> Read this before deploying or reimporting the project.

---

## Required Secrets

### Dev Secrets (set automatically by Replit)

| Secret | Set by |
|---|---|
| `DATABASE_URL` | Replit PostgreSQL integration — set automatically, do not override |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | Replit PostgreSQL integration — set automatically |

### Deployments → Secrets (must be set manually)

Only two secrets need to be set in **Deployments → Secrets**:

| Secret | Purpose | How to get |
|---|---|---|
| `GROQ_API_KEY` | AI chat + promo content generation | [console.groq.com](https://console.groq.com) → API Keys (free) |
| `BOTFORGE_CEO_PASSWORD` | Admin dashboard password gate | Set any strong password |

> **Do NOT add `DATABASE_URL` to Deployments → Secrets.**
> Replit injects the correct production connection string automatically.
> A manually-set `DATABASE_URL` in Deployments → Secrets will override Replit's
> injection and will likely point to `helium` (the dev-only internal alias),
> causing a silent TCP hang on production startup. See "Database" section below.

Run `pnpm run secrets:check` at any time to validate all secrets and hostname safety.

---

## Database

### How Replit Manages the PostgreSQL Database

BotForge uses **Replit's managed PostgreSQL** database, provisioned via the Replit
PostgreSQL integration. Replit exposes it differently in each environment:

| Environment | `DATABASE_URL` hostname | Reachable? |
|---|---|---|
| Dev container | `helium` (internal container alias, e.g. `172.24.0.3`) | Yes — private network |
| Production container | Proper public FQDN injected by Replit automatically | Yes — public network |

`helium` is Replit's internal alias for the managed PostgreSQL service running in the
dev container. It is **not** an external database — it IS the Replit-managed database.
The Replit Database panel may show "external database detected" for this URL; this is a
UI classification quirk (the old PostgreSQL integration flow vs. the newer Database panel
UI), not a sign that the database is unmanaged or externally hosted.

### The Most Common Production Mistake

**Symptom:** "Built successfully but failed to start" — server hangs for ~15 seconds
(with `connect_timeout=15` fix applied; previously ~60 seconds), then exits with a TCP
timeout error. No useful error in the build log.

**Cause:** Someone manually added `DATABASE_URL` to **Deployments → Secrets** with the
dev value (`postgresql://...@helium/...`). That overrides Replit's automatic production
injection, and `helium` doesn't resolve in the production container's network namespace.

**Fix:** Go to **Deployments → Secrets** and **delete** the `DATABASE_URL` entry.
Replit will inject the correct production connection string on the next deploy.

### Self-Diagnosing Guards

Two layers catch a bad `DATABASE_URL` automatically:

1. **Pre-deploy build gate** (`artifact.toml`) — `pnpm run secrets:check` runs before
   the production build. If the hostname is internal-only, the build aborts immediately
   with a clear message instead of letting a broken deploy through.

2. **Server boot warning** (`lib/secrets-check.ts`) — on every startup, `runSecretsCheck()`
   inspects the `DATABASE_URL` hostname and logs a `WARN` block if it is internal. The
   server still boots in dev (where `helium` is reachable and expected); only a warning
   is logged. In production, the pre-deploy gate should have already blocked a bad URL
   from reaching this point.

### Hostname Detection Heuristics

The guard flags any of:
- Known Replit dev-container aliases: `helium`, `neon-proxy`, `db`, `postgres`, `database`
- Single-label hostname with no dots — can never be a real public FQDN
- Loopback addresses: `localhost`, `127.0.0.1`, `::1`
- RFC-1918 private IPs: `10.x`, `172.16–31.x`, `192.168.x`

A correct production URL with a dotted public FQDN passes silently.

---

## connect_timeout Fix

### Problem

`pg.Pool`'s `connectionTimeoutMillis` option controls how long to wait for an **idle
client from the pool queue** — it is **not** a TCP socket connection timeout. When the
DB host is unreachable and silently drops SYN packets, `connectionTimeoutMillis` never
fires. The pool hangs at the OS TCP layer until the deployment kills the process.

### Fix Applied

All three locations that create a `pg.Pool` append `connect_timeout=15` (or
`connect_timeout=5` for the health ping) to the connection URL. This is a PostgreSQL
protocol-level parameter that instructs `libpq` to abort the TCP handshake after N
seconds.

```ts
// Pattern used in db-migrate.ts, routes/leads.ts, routes/health.ts
const dbUrlWithTimeout = dbUrl.includes("?")
  ? `${dbUrl}&connect_timeout=15`
  : `${dbUrl}?connect_timeout=15`;
const pool = new Pool({ connectionString: dbUrlWithTimeout, ... });
```

**Effect with a bad hostname:** fails in ~15 seconds with a clear timeout error +
`process.exit(1)`, instead of hanging silently. Combined with the pre-deploy hostname
guard, this situation should never reach production in the first place.

---

## Schema & Migrations

Migrations run automatically on every server boot (`index.ts` calls `runMigrations()`
before `app.listen()`). They are fully idempotent:

- `CREATE TABLE IF NOT EXISTS businesses`
- `CREATE TABLE IF NOT EXISTS leads`
- `ALTER TABLE leads ADD COLUMN IF NOT EXISTS contacted BOOLEAN NOT NULL DEFAULT FALSE`
- Seeds "Styled By Fortune" only when `businesses` table is completely empty

If migrations fail (e.g. bad `DATABASE_URL`), the server exits with code 1 before
binding to port 8080, so the deployment healthcheck never passes.

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

If you see `⚠️  DATABASE_URL HOSTNAME WARNING` in the pre-deploy output — stop, **remove**
any manually-set `DATABASE_URL` from Deployments → Secrets, confirm Replit can inject
the production URL, then re-run before deploying.

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

The chatbot was migrated from port 22967 → 3000 (22967 is not in Replit's supported
preview port list). This only affects the dev workflow; production serves the chatbot
as static files with no runtime process.
