---
name: og_image_filename wipe by admin PUT
description: Root cause and fix for recurring Rossy OG preview bug — admin edit form wipes og_image_filename via PUT route every time any field is saved.
---

# og_image_filename wiped by admin PUT route

## The rule
The `og_image_filename` column must be protected in the PUT route with `COALESCE($14, og_image_filename)` instead of `og_image_filename=$14`. Without this, every admin edit of any field clears the value to NULL.

**Why:** The admin edit form (`AddBusinessModal`) has no `ogImageFilename` field. When the form submits, `ogImageFilename` is absent from the body → `undefined?.trim() || null` → `null` → `og_image_filename = NULL` in the DB. The value is wiped silently on every save.

**How to apply:** The fix is already in `artifacts/api-server/src/routes/businesses.ts` (PUT route, `COALESCE($14, og_image_filename)`). Any future column added to the DB that is not in the admin form must use the same COALESCE pattern in the PUT SET clause, or be excluded from the SET clause entirely.

## Self-healing migration (belt-and-suspenders)

The seed INSERT in `db-migrate.ts` was changed from `ON CONFLICT (id) DO NOTHING` to:
```sql
ON CONFLICT (id) DO UPDATE
  SET og_image_filename = EXCLUDED.og_image_filename
  WHERE businesses.og_image_filename IS NULL
     OR businesses.og_image_filename = ''
```

This means every server boot restores `og_image_filename` from seed data if it was wiped to NULL or empty string. The backfill WHERE clause was also extended to `AND (og_image_filename IS NULL OR og_image_filename = '')`.

## Recurring cycle (now broken)
Before fix: boot → backfill sets 'rossy.jpg' → admin edits → PUT sets NULL → broken until next boot.
After fix: PUT preserves existing value via COALESCE → value never wiped again. Boot-time seed DO UPDATE is a safety net if it somehow becomes NULL anyway.
