import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/requireAdmin";
import { pool } from "../lib/db";

const router: IRouter = Router();

// ── GET /admin/export — full read-only backup snapshot ────────────────────────
// Returns all businesses (full config) and all leads (including note field).
// Admin-only, no writes of any kind.

router.get("/admin/export", requireAdmin, async (req, res): Promise<void> => {
  try {
    const [bizResult, leadsResult] = await Promise.all([
      pool.query(`
        SELECT id, biz_name, biz_type, phone, services, location,
               how_to_order, instagram, personality, welcome_msg,
               accent_color, slug, previous_slugs, created_at
        FROM businesses
        ORDER BY created_at ASC
      `),
      pool.query(`
        SELECT id, business_id, timestamp, customer_name,
               services_interested, booking_intent, questions_asked,
               conversation_length, summary_text, contacted, note
        FROM leads
        ORDER BY timestamp DESC
      `),
    ]);

    const businesses = bizResult.rows.map((r) => ({
      id: r.id as string,
      bizName: r.biz_name as string,
      bizType: r.biz_type as string,
      phone: (r.phone as string | null) ?? null,
      services: (r.services as string | null) ?? null,
      location: (r.location as string | null) ?? null,
      howToOrder: (r.how_to_order as string | null) ?? null,
      instagram: (r.instagram as string | null) ?? null,
      personality: (r.personality as string | null) ?? null,
      welcomeMsg: (r.welcome_msg as string | null) ?? null,
      accentColor: (r.accent_color as string | null) ?? null,
      slug: (r.slug as string | null) ?? null,
      previousSlugs: (r.previous_slugs as string[]) ?? [],
      createdAt: (r.created_at as Date).toISOString(),
    }));

    const leads = leadsResult.rows.map((r) => ({
      id: r.id as string,
      businessId: r.business_id as string,
      timestamp: (r.timestamp as Date).toISOString(),
      customerName: (r.customer_name as string | null) ?? null,
      servicesInterested: (r.services_interested as string[]) ?? [],
      bookingIntent: r.booking_intent as string,
      questionsAsked: (r.questions_asked as string[]) ?? [],
      conversationLength: (r.conversation_length as number) ?? 0,
      summaryText: (r.summary_text as string) ?? "",
      contacted: (r.contacted as boolean) ?? false,
      note: (r.note as string | null) ?? null,
    }));

    const payload = {
      exportedAt: new Date().toISOString(),
      businesses,
      leads,
    };

    logger.info(
      { businessCount: businesses.length, leadCount: leads.length },
      "Admin export requested"
    );

    res.json(payload);
  } catch (err) {
    logger.error({ err }, "Failed to generate admin export");
    res.status(500).json({ error: "Failed to generate export" });
  }
});

export default router;
