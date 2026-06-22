import { Router, type IRouter } from "express";
import { Pool } from "pg";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

// ── GET /businesses ───────────────────────────────────────────────────────────

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

// ── POST /businesses ──────────────────────────────────────────────────────────

router.post("/businesses", async (req, res): Promise<void> => {
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
    // ensure unique id by appending a suffix if needed
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

export default router;
