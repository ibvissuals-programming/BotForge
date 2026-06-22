import { Router, type IRouter } from "express";
import { Pool } from "pg";
import { logger } from "../lib/logger";
import type { Lead } from "../types/lead";

const router: IRouter = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function rowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    timestamp: (row.timestamp as Date).toISOString(),
    customerName: (row.customer_name as string | null) ?? null,
    servicesInterested: (row.services_interested as string[]) ?? [],
    bookingIntent: (row.booking_intent as Lead["bookingIntent"]) ?? "low",
    questionsAsked: (row.questions_asked as string[]) ?? [],
    conversationLength: (row.conversation_length as number) ?? 0,
    summaryText: (row.summary_text as string) ?? "",
  };
}

// ── POST /leads ───────────────────────────────────────────────────────────────

router.post("/leads", async (req, res): Promise<void> => {
  const lead = req.body as Partial<Lead>;

  if (!lead.businessId || !lead.timestamp || !lead.id) {
    res.status(400).json({ error: "id, businessId, and timestamp are required" });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO leads
         (id, business_id, timestamp, customer_name, services_interested,
          booking_intent, questions_asked, conversation_length, summary_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        lead.id,
        lead.businessId,
        lead.timestamp,
        lead.customerName ?? null,
        lead.servicesInterested ?? [],
        lead.bookingIntent ?? "low",
        lead.questionsAsked ?? [],
        lead.conversationLength ?? 0,
        lead.summaryText ?? "",
      ]
    );
    logger.info({ leadId: lead.id, businessId: lead.businessId }, "Lead captured");
    res.status(201).json({ ok: true, id: lead.id });
  } catch (err) {
    logger.error({ err }, "Failed to save lead");
    res.status(500).json({ error: "Failed to save lead" });
  }
});

// ── GET /leads ────────────────────────────────────────────────────────────────

router.get("/leads", async (req, res): Promise<void> => {
  const { businessId } = req.query as { businessId?: string };

  try {
    const result = businessId
      ? await pool.query(
          "SELECT * FROM leads WHERE business_id = $1 ORDER BY timestamp DESC",
          [businessId]
        )
      : await pool.query("SELECT * FROM leads ORDER BY timestamp DESC");

    res.json(result.rows.map(rowToLead));
  } catch (err) {
    logger.error({ err }, "Failed to fetch leads");
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

export default router;
