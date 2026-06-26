import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/requireAdmin";
import type { Lead } from "../types/lead";
import { pool } from "../lib/db";

const router: IRouter = Router();

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
    contacted: (row.contacted as boolean) ?? false,
  };
}

// ── POST /leads — public (chatbot WhatsApp handoff posts leads here) ──────────

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

// ── GET /leads — admin only ───────────────────────────────────────────────────

router.get("/leads", requireAdmin, async (req, res): Promise<void> => {
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

// ── PATCH /leads/:id/contacted — admin only ───────────────────────────────────

router.patch("/leads/:id/contacted", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { contacted } = req.body as { contacted?: boolean };

  if (typeof contacted !== "boolean") {
    res.status(400).json({ error: "contacted (boolean) is required" });
    return;
  }

  try {
    const result = await pool.query(
      "UPDATE leads SET contacted = $1 WHERE id = $2 RETURNING *",
      [contacted, id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    logger.info({ id, contacted }, "Lead contacted status updated");
    res.json(rowToLead(result.rows[0]));
  } catch (err) {
    logger.error({ err }, "Failed to update lead contacted status");
    res.status(500).json({ error: "Failed to update contacted status" });
  }
});

export default router;
