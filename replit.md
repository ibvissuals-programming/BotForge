# BotForge

Multi-tenant AI chatbot admin dashboard. Each client (business) gets a
fully-configured AI chatbot that answers customer questions and captures
leads via a WhatsApp handoff. The admin dashboard lets the operator manage
businesses, view leads, export CSV, and generate promo content.

---

## ⚡ Agent — First Action on Any Fresh Import

**Before starting workflows or doing anything else**, run:

```
pnpm run secrets:check
```

This checks that `GROQ_API_KEY`, `BOTFORGE_CEO_PASSWORD`, and `DATABASE_URL`
are all present. Report exactly which are missing and wait for the user to add
them before proceeding. Do not start workflows until secrets:check is green.

After secrets are confirmed, follow the "First Time Setup" section in
`DEPLOYMENT.md` for the complete ordered setup sequence.

---

## Run & Operate

```
pnpm --filter @workspace/api-server run dev   # API server (port 8080)
pnpm --filter @workspace/chatbot run dev      # Chatbot UI (port 3000)
pnpm run secrets:check                        # Validate all required secrets
pnpm run pre-publish                          # 7-check smoke test (requires both workflows running)
pnpm run typecheck                            # Full typecheck across all packages
pnpm run build                                # Typecheck + build all packages
```

### Required secrets (editor)

| Secret | Set by |
|---|---|
| `DATABASE_URL` | Replit PostgreSQL integration — automatic, do not override |
| `GROQ_API_KEY` | Must be added manually — get from console.groq.com |
| `BOTFORGE_CEO_PASSWORD` | Must be added manually — any strong password |

### Required secrets (Deployments → Secrets, production only)

| Secret | Notes |
|---|---|
| `GROQ_API_KEY` | Same key as above |
| `BOTFORGE_CEO_PASSWORD` | Same password as above |

**Do NOT add `DATABASE_URL` to Deployments → Secrets.** Replit injects the
correct production value automatically. See `DEPLOYMENT.md` for the full
explanation.

---

## Stack

- **Runtime:** Node.js 24, TypeScript 5.9, pnpm workspaces
- **API:** Express 5, raw `pg` queries (no ORM — Drizzle is intentionally disabled)
- **Database:** Replit managed PostgreSQL — auto-migrated on every server boot
- **Chatbot UI:** React 19, Vite 7, Tailwind CSS v4
- **AI:** Groq SDK (llama-3.3-70b-versatile)
- **Build:** esbuild (ESM bundle for api-server), Vite static build for chatbot

---

## Where things live

| Area | Path |
|---|---|
| API server entry | `artifacts/api-server/src/index.ts` |
| DB schema + migrations + seed | `artifacts/api-server/src/lib/db-migrate.ts` |
| API routes | `artifacts/api-server/src/routes/` |
| Admin dashboard UI | `artifacts/chatbot/src/pages/AdminPage.tsx` |
| Chatbot UI | `artifacts/chatbot/src/pages/ChatPage.tsx` |
| Pre-publish smoke test | `scripts/src/pre-publish-check.ts` |
| Deployment guide | `DEPLOYMENT.md` |

---

## Architecture decisions

- **Raw `pg` queries, no ORM.** Drizzle was started but disabled. All schema
  lives in `db-migrate.ts` as `CREATE TABLE IF NOT EXISTS` SQL. Do not
  re-enable Drizzle or run `drizzle-kit push`.

- **Auto-migration on every boot.** `runMigrations()` is called in `index.ts`
  before `app.listen()`. It is idempotent — safe to run on every start.
  Fortune's seed fires only when `businesses` table is completely empty.

- **Token-based admin auth.** `POST /api/auth/admin-login` validates
  `BOTFORGE_CEO_PASSWORD` and returns a short-lived HMAC-SHA256 signed token
  (`expiry.hex_sig`, 24 h TTL, keyed on `BOTFORGE_CEO_PASSWORD`). Every
  subsequent admin request sends it in the `x-admin-token` header; `requireAdmin`
  verifies it via `timingSafeEqual`. There are no sessions, no cookies, and no
  `SESSION_SECRET` — that env var is unused.

- **`DATABASE_URL` must not be in Deployments → Secrets.** Replit injects the
  production value automatically. A manually-set value overrides the injection
  and causes a silent TCP hang on startup. See `DEPLOYMENT.md`.

- **`[services.env]` in artifact.toml, not `[services.production.run.env]`.**
  Only `[services.env]` is recognised for injecting env vars into the
  production process. The wrong key is silently ignored. See `DEPLOYMENT.md`.

---

## Product

BotForge is a white-label AI chatbot SaaS. The operator (admin) configures
client businesses — name, services, pricing, personality — and BotForge
generates a shareable chatbot link for each. Customers chat with the AI,
which captures their details and intent. High-intent leads trigger a WhatsApp
handoff. The admin dashboard shows all leads across all clients with filtering,
search, CSV export, and direct navigation from each business card.

---

## User preferences

- No emojis in code or comments unless the user explicitly requests them.
- No Drizzle, no drizzle-kit. All DB work via raw pg queries in db-migrate.ts.
- Do not add DATABASE_URL to Deployments → Secrets.
- pnpm only — no npm or yarn.

---

## Gotchas

- **Always run `pnpm run secrets:check` before starting workflows on a fresh
  import.** The server will hang silently if DATABASE_URL is missing or points
  to the dev-only `helium` hostname in production.
- **`connect_timeout=15` is appended to DATABASE_URL in all `pg.Pool`
  constructors.** This is intentional — it makes TCP failures fast and loud
  instead of silent and slow. Do not remove it.
- **The chatbot workflow reads `PORT` from the environment.** It is set to 3000
  via `[services.env]` in `artifacts/chatbot/.replit-artifact/artifact.toml`.
  Do not hardcode the port in `vite.config.ts`.
- **`replit-artifact/artifact.toml` uses `[services.env]`, not
  `[services.production.run.env]`.** The latter is silently ignored by Replit.
- **The admin page is at `/admin`.** Each chatbot is at `/:slug` (e.g.
  `/styledbyfortune`). The legacy `?c=<encoded-config>` query-string format
  still works for backwards compatibility but slug routing is the primary path.
