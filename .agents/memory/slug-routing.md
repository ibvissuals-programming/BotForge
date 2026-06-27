---
name: Slug routing architecture
description: How short slug URLs work for chatbot pages (e.g. /fortune, /rossy)
---

## Rule
Each business has a `slug TEXT UNIQUE` column (short, first-word derived). Routes:
- `/:slug` → ChatPage (slug lookup from API `/api/businesses`)
- `/` → AdminGate unless `#c=` hash or `?c=` query param is present (backwards compat)
- `/admin` → AdminGate always

**Why:** Clients needed clean sharable links (e.g. `/fortune`) rather than long base64 hash URLs. Hash/query links kept working so old QR codes don't break.

**How to apply:**
- Seed slugs are explicit (`fortune`, `rossy`). New businesses via POST get `toShortSlug(bizName)` (first word, lowercased, counter-suffix if conflict).
- ChatPage reads `useParams<{ slug? }>()` from wouter; useEffect priority: 1) `#c=`/`?c=`, 2) slug route param.
- AdminPage `chatUrl` uses `buildSlugUrl(slug)` when slug present, falls back to `buildShareableUrl(config)`.
- `buildSlugUrl` is in `artifacts/chatbot/src/lib/configUrl.ts`.
- DB migration: `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE` + backfill UPDATE in `db-migrate.ts`.
