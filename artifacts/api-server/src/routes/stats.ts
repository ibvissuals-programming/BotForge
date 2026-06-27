import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import { pool } from "../lib/db";

const router: IRouter = Router();

export interface WeeklyStats {
  messages: number;
  leads: number;
  lastActive: string | null;
}

/** GET /stats/weekly — per-business message + lead counts and last-active timestamp */
router.get("/stats/weekly", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [msgResult, leadResult, lastActiveResult] = await Promise.all([
      pool.query<{ business_id: string; cnt: number }>(
        `SELECT business_id, COUNT(*)::int AS cnt
         FROM message_events
         WHERE sent_at >= $1
         GROUP BY business_id`,
        [since],
      ),
      pool.query<{ business_id: string; cnt: number }>(
        `SELECT business_id, COUNT(*)::int AS cnt
         FROM leads
         WHERE timestamp >= $1
         GROUP BY business_id`,
        [since],
      ),
      pool.query<{ business_id: string; last_active: string }>(
        `SELECT business_id, MAX(sent_at)::text AS last_active
         FROM message_events
         GROUP BY business_id`,
      ),
    ]);

    const stats: Record<string, WeeklyStats> = {};

    for (const row of msgResult.rows) {
      stats[row.business_id] = { messages: row.cnt, leads: 0, lastActive: null };
    }
    for (const row of leadResult.rows) {
      if (!stats[row.business_id]) stats[row.business_id] = { messages: 0, leads: 0, lastActive: null };
      stats[row.business_id].leads = row.cnt;
    }
    for (const row of lastActiveResult.rows) {
      if (!stats[row.business_id]) stats[row.business_id] = { messages: 0, leads: 0, lastActive: null };
      stats[row.business_id].lastActive = row.last_active;
    }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch weekly stats" });
  }
});

export default router;
