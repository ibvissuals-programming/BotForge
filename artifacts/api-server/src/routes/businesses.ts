import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/requireAdmin";
import { pool } from "../lib/db";

const router: IRouter = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Business {
  id: string;
  bizName: string;
  bizType: string;
  phone?: string | null;
  services?: string | null;
  location?: string | null;
  howToOrder?: string | null;
  instagram?: string | null;
  personality?: string | null;
  welcomeMsg?: string | null;
  accentColor?: string | null;
  slug?: string | null;
  previousSlugs?: string[];
  backgroundTheme?: string | null;
  lightThemePalette?: string | null;
  lightThemeStyle?: string | null;
}

function rowToBusiness(row: Record<string, unknown>): Business {
  return {
    id: row.id as string,
    bizName: row.biz_name as string,
    bizType: row.biz_type as string,
    phone: (row.phone as string | null) ?? null,
    services: (row.services as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    howToOrder: (row.how_to_order as string | null) ?? null,
    instagram: (row.instagram as string | null) ?? null,
    personality: (row.personality as string | null) ?? null,
    welcomeMsg: (row.welcome_msg as string | null) ?? null,
    accentColor: (row.accent_color as string | null) ?? null,
    slug: (row.slug as string | null) ?? null,
    previousSlugs: (row.previous_slugs as string[] | null) ?? [],
    backgroundTheme: (row.background_theme as string | null) ?? "dark",
    lightThemePalette: (row.light_theme_palette as string | null) ?? null,
    lightThemeStyle: (row.light_theme_style as string | null) ?? "plain",
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

// Derives a short, human-readable URL slug from the first meaningful word of
// a business name (e.g. "Rossy Cakes & Events" → "rossy").
function toShortSlug(name: string): string {
  const word = name.toLowerCase().trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, "");
  return word.slice(0, 30) || "business";
}

// Returns null when the slug is valid, or an error string describing the problem.
function validateSlugFormat(slug: string): string | null {
  if (slug.length === 0) return "Slug must not be empty.";
  if (slug.length > 60) return "Slug must be 60 characters or fewer.";
  if (!/^[a-z0-9-]+$/.test(slug)) return "Slug may only contain lowercase letters, numbers, and hyphens.";
  if (slug.startsWith("-") || slug.endsWith("-")) return "Slug must not start or end with a hyphen.";
  return null;
}

// ── GET /businesses — public (ChatPage uses this to load bot config) ──────────

router.get("/businesses", async (_req, res): Promise<void> => {
  try {
    const result = await pool.query(
      "SELECT * FROM businesses ORDER BY created_at ASC"
    );
    res.json(result.rows.map(rowToBusiness));
  } catch (err) {
    logger.error({ err }, "Failed to fetch businesses");
    res.status(500).json({ error: "Failed to fetch businesses" });
  }
});

// ── POST /businesses — admin only ─────────────────────────────────────────────

router.post("/businesses", requireAdmin, async (req, res): Promise<void> => {
  const {
    bizName,
    bizType,
    phone,
    services,
    location,
    howToOrder,
    instagram,
    personality,
    welcomeMsg,
    accentColor,
    backgroundTheme,
    lightThemePalette,
    lightThemeStyle,
    slug: requestedSlugRaw,
  } = req.body as Partial<Business>;

  if (!bizName?.trim() || !bizType?.trim()) {
    res.status(400).json({ error: "bizName and bizType are required" });
    return;
  }

  // Validate custom slug format before hitting the DB
  const requestedSlug = (requestedSlugRaw ?? "").trim().toLowerCase();
  if (requestedSlug) {
    const fmtErr = validateSlugFormat(requestedSlug);
    if (fmtErr) {
      res.status(400).json({ error: fmtErr });
      return;
    }
  }

  const baseId = slugify(bizName);

  try {
    const existing = await pool.query(
      "SELECT id FROM businesses WHERE id LIKE $1 ORDER BY created_at DESC LIMIT 10",
      [`${baseId}%`]
    );
    let id = baseId;
    if (existing.rows.length > 0) {
      const ids = new Set(existing.rows.map((r: Record<string, unknown>) => r.id as string));
      if (ids.has(id)) {
        let n = 2;
        while (ids.has(`${baseId}-${n}`)) n++;
        id = `${baseId}-${n}`;
      }
    }

    let slug: string;
    if (requestedSlug) {
      // Admin supplied a custom slug — check uniqueness, then use it as-is.
      const taken = await pool.query("SELECT id FROM businesses WHERE slug = $1", [requestedSlug]);
      if ((taken.rowCount ?? 0) > 0) {
        res.status(409).json({ error: `The slug "${requestedSlug}" is already taken. Choose a different one.` });
        return;
      }
      slug = requestedSlug;
    } else {
      // Auto-generate from the first word of the business name.
      // Append a numeric suffix if the base slug is already taken.
      const baseSlug = toShortSlug(bizName);
      const existingSlugs = await pool.query(
        "SELECT slug FROM businesses WHERE slug LIKE $1",
        [`${baseSlug}%`]
      );
      slug = baseSlug;
      if (existingSlugs.rows.length > 0) {
        const slugs = new Set(
          existingSlugs.rows
            .map((r: Record<string, unknown>) => r.slug as string | null)
            .filter(Boolean) as string[]
        );
        if (slugs.has(slug)) {
          let n = 2;
          while (slugs.has(`${baseSlug}${n}`)) n++;
          slug = `${baseSlug}${n}`;
        }
      }
    }

    const result = await pool.query(
      `INSERT INTO businesses
         (id, biz_name, biz_type, phone, services, location, how_to_order,
          instagram, personality, welcome_msg, accent_color, slug, background_theme, light_theme_palette, light_theme_style)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        id,
        bizName.trim(),
        bizType.trim(),
        phone?.trim() || null,
        services?.trim() || null,
        location?.trim() || null,
        howToOrder?.trim() || null,
        instagram?.trim() || null,
        personality?.trim() || null,
        welcomeMsg?.trim() || null,
        accentColor?.trim() || null,
        slug,
        backgroundTheme?.trim() || "dark",
        lightThemePalette?.trim() || null,
        lightThemeStyle?.trim() || "plain",
      ]
    );

    res.status(201).json(rowToBusiness(result.rows[0]));
  } catch (err) {
    logger.error({ err }, "Failed to create business");
    res.status(500).json({ error: "Failed to create business" });
  }
});

// ── PUT /businesses/:id — admin only ──────────────────────────────────────────

router.put("/businesses/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const {
    bizName,
    bizType,
    phone,
    services,
    location,
    howToOrder,
    instagram,
    personality,
    welcomeMsg,
    accentColor,
    backgroundTheme,
    lightThemePalette,
    lightThemeStyle,
    slug: requestedSlugRaw,
  } = req.body as Partial<Business>;

  if (!bizName?.trim() || !bizType?.trim()) {
    res.status(400).json({ error: "bizName and bizType are required" });
    return;
  }

  // Validate slug format before hitting the DB.
  // An empty string means "keep existing slug" — not an error.
  const requestedSlug = (requestedSlugRaw ?? "").trim().toLowerCase();
  if (requestedSlug) {
    const fmtErr = validateSlugFormat(requestedSlug);
    if (fmtErr) {
      res.status(400).json({ error: fmtErr });
      return;
    }
  }

  try {
    // Check uniqueness: the new slug must not be held by a DIFFERENT business.
    if (requestedSlug) {
      const taken = await pool.query(
        "SELECT id FROM businesses WHERE slug = $1 AND id != $2",
        [requestedSlug, id]
      );
      if ((taken.rowCount ?? 0) > 0) {
        res.status(409).json({ error: `The slug "${requestedSlug}" is already taken. Choose a different one.` });
        return;
      }
    }

    // When the slug changes, move the OLD slug into previous_slugs so that
    // customers who already have the old link bookmarked are never broken.
    // The CASE expression references the column's CURRENT value before SET runs,
    // so "slug" inside the CASE is the old value being replaced.
    const result = await pool.query(
      `UPDATE businesses
       SET biz_name=$1, biz_type=$2, phone=$3, services=$4, location=$5,
           how_to_order=$6, instagram=$7, personality=$8, welcome_msg=$9,
           accent_color=$10, background_theme=$11, light_theme_palette=$12,
           light_theme_style=$13,
           slug = CASE WHEN $14::TEXT = '' THEN slug ELSE $14 END,
           previous_slugs = CASE
             WHEN $14::TEXT != ''
               AND slug IS NOT NULL
               AND slug != $14
               AND NOT (COALESCE(previous_slugs, '{}') @> ARRAY[slug])
             THEN array_append(COALESCE(previous_slugs, '{}'), slug)
             ELSE COALESCE(previous_slugs, '{}')
           END
       WHERE id=$15
       RETURNING *`,
      [
        bizName.trim(),
        bizType.trim(),
        phone?.trim() || null,
        services?.trim() || null,
        location?.trim() || null,
        howToOrder?.trim() || null,
        instagram?.trim() || null,
        personality?.trim() || null,
        welcomeMsg?.trim() || null,
        accentColor?.trim() || null,
        backgroundTheme?.trim() || "dark",
        lightThemePalette?.trim() || null,
        lightThemeStyle?.trim() || "plain",
        requestedSlug,
        id,
      ]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Business not found" });
      return;
    }
    res.json(rowToBusiness(result.rows[0]));
  } catch (err) {
    logger.error({ err }, "Failed to update business");
    res.status(500).json({ error: "Failed to update business" });
  }
});

// ── DELETE /businesses/:id — admin only ───────────────────────────────────────

router.delete("/businesses/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM businesses WHERE id = $1 RETURNING id",
      [id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Business not found" });
      return;
    }
    res.json({ ok: true, id });
  } catch (err) {
    logger.error({ err }, "Failed to delete business");
    res.status(500).json({ error: "Failed to delete business" });
  }
});

export default router;
