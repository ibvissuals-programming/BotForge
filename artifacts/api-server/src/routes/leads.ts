import { Router, type IRouter } from "express";
import type { Lead } from "../types/lead";

const router: IRouter = Router();

/** In-memory store — swap for a DB call when persistence is needed. */
const leads: Lead[] = [];

/** POST /leads — store a captured lead (non-blocking from the client side) */
router.post("/leads", (req, res): void => {
  const lead = req.body as Partial<Lead>;

  if (!lead.businessId || !lead.timestamp || !lead.id) {
    res.status(400).json({ error: "id, businessId, and timestamp are required" });
    return;
  }

  leads.push(lead as Lead);
  req.log.info({ leadId: lead.id, businessId: lead.businessId }, "Lead captured");
  res.status(201).json({ ok: true, id: lead.id });
});

/** GET /leads — retrieve all leads (for a future admin dashboard) */
router.get("/leads", (_req, res): void => {
  res.json(leads);
});

export default router;
