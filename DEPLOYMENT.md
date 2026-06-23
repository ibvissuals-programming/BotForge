# BotForge — Deployment Guide & Production Gotchas

> Captures every production issue found and fixed in the June 2026 session.
> Read this before deploying or reimporting the project.

---

## ⚠️ "1 secret out of sync" Warning on the Publish Screen — Expected, Safe to Ignore

**You will always see this warning when publishing.** It looks alarming but is
purely informational and will never cause a deploy failure.

### What the warning says
> "1 secret out of sync — a project editor secret is missing from this environment"
> Referencing: `DATABASE_URL` (and possibly `PGHOST`, `PGPORT`, `PGUSER`,
> `PGPASSWORD`, `PGDATABASE`)

### Why it appears

Replit's Publish screen does a mechanical diff between two secret namespaces:

| Namespace | Who sets it | What's there |
|---|---|---|
| **Editor secrets** | Replit PostgreSQL integration (automatic) | `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` |
| **Deployments → Secrets** | You (manually) | `GROQ_API_KEY`, `BOTFORGE_CEO_PASSWORD` only |

`DATABASE_URL` is present in the editor but **intentionally absent** from
Deployments → Secrets. Replit's publish UI sees this gap and calls it "out of
sync." It is not an error — it is the correct, deliberate configuration.

### Why DATABASE_URL must NOT be in Deployments → Secrets

Replit injects its own production `DATABASE_URL` automatically into every
deployed process. If you manually add `DATABASE_URL` to Deployments → Secrets,
your manually-set value **overrides** Replit's injection. That manual value
almost always contains the `helium` dev-container hostname, which is
unreachable from production — causing a silent TCP hang on startup.

The fix is to leave `DATABASE_URL` out of Deployments → Secrets entirely and
let Replit inject it. The "out of sync" warning is the side-effect of doing
exactly the right thing.

### How to respond to this warning

**Nothing.** Click through and continue the publish. Do not add `DATABASE_URL`
to Deployments → Secrets in an attempt to silence the warning — that would
break production.

---

## Pre-Publish Checklist

Run these steps **in order** before every publish attempt. Each step catches a
different class of failure. Do not skip any.

### Step 1 — Run the secrets check

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

If any secret shows ❌, add it in Replit → Deployments → Secrets and re-run.

If you see `⚠️  DATABASE_URL HOSTNAME WARNING` — stop. See Step 2.

### Step 2 — Confirm DATABASE_URL is NOT in Deployments → Secrets

Go to **Replit → Deployments → Secrets** and verify that `DATABASE_URL` is
**not listed there**. Replit injects the correct production connection string
automatically. A manually-added `DATABASE_URL` (which will contain the dev
`helium` hostname) overrides Replit's injection and causes a TCP hang on
startup. Delete it if present.

Only these two secrets should be in Deployments → Secrets:
- `GROQ_API_KEY`
- `BOTFORGE_CEO_PASSWORD`

### Step 3 — Confirm artifact.toml uses `[services.env]`

Open `artifacts/api-server/.replit-artifact/artifact.toml` and verify the env
var block reads exactly:

```toml
[services.env]
PORT = "8080"
NODE_ENV = "production"
```

**Do not rename this section.** `[services.env]` is the only section name
Replit recognises for injecting env vars into the production run process. Any
other name (e.g. `[services.production.run.env]`) is silently ignored — see
"PORT / artifact.toml Bug" section below for the full history.

### Step 4 — Publish

All three checks green → publish.

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

## PORT / artifact.toml Bug

### Root Cause (June 2026)

**Symptom:** Build passed green (secrets:check ✅, TypeScript build ✅), but deployment
failed with:

```
seccomp port detection incomplete
not all artifact ports opened
a port configuration was specified
sending SIGTERM to artifact process
all artifact processes stopped
```

**Root cause:** `artifact.toml` used `[services.production.run.env]` to set `PORT`:

```toml
# WRONG — this section name is not recognised by Replit
[services.production.run.env]
PORT = "8080"
NODE_ENV = "production"
```

`[services.production.run.env]` is **not** a valid section in Replit's artifact.toml
schema. Replit silently ignored it, so `PORT` was never set in the production process
environment. `index.ts` throws `"PORT environment variable is required but was not
provided."` on startup — before `app.listen()` is ever called. Replit's seccomp
monitoring waited for `localPort = 8080` to be opened by the process, never saw it,
and sent SIGTERM.

The build log showed no error because the bug only manifests at runtime, not at build
time.

**Fix applied:** Changed to the recognised section name `[services.env]`:

```toml
# CORRECT — [services.env] is the section Replit recognises
[services.env]
PORT = "8080"
NODE_ENV = "production"
```

### Why `[services.env]` works in dev too

The dev script (`package.json`) explicitly sets `export NODE_ENV=development` before
running the server. This shell export overrides the `NODE_ENV = "production"` from
`[services.env]`, so the dev server always runs in development mode. `PORT = "8080"`
is consistent across both environments and causes no conflict.

### How to verify

Open `artifacts/api-server/.replit-artifact/artifact.toml` and confirm:

```toml
[services.env]
PORT = "8080"
NODE_ENV = "production"
```

There must be **no** `[services.production.run.env]` block anywhere in the file.

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
