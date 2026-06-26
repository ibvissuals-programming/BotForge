import { Router, type IRouter } from "express";
import { Pool } from "pg";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

function dbUrlWithTimeout(url: string | undefined, secs = 15): string | undefined {
  if (!url) return url;
  return url.includes("?") ? `${url}&connect_timeout=${secs}` : `${url}?connect_timeout=${secs}`;
}

const pool = new Pool({ connectionString: dbUrlWithTimeout(process.env.DATABASE_URL) });

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
  } = req.body as Partial<Business>;

  if (!bizName?.trim() || !bizType?.trim()) {
    res.status(400).json({ error: "bizName and bizType are required" });
    return;
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

    const result = await pool.query(
      `INSERT INTO businesses
         (id, biz_name, biz_type, phone, services, location, how_to_order,
          instagram, personality, welcome_msg, accent_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
  } = req.body as Partial<Business>;

  if (!bizName?.trim() || !bizType?.trim()) {
    res.status(400).json({ error: "bizName and bizType are required" });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE businesses
       SET biz_name=$1, biz_type=$2, phone=$3, services=$4, location=$5,
           how_to_order=$6, instagram=$7, personality=$8, welcome_msg=$9,
           accent_color=$10
       WHERE id=$11
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
