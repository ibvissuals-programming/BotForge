import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { SendChatMessageBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { groqComplete, GroqRateLimitError } from "../lib/groq";
import { pool } from "../lib/db";
import type { Lead, BookingIntent } from "../types/lead";

const router: IRouter = Router();

if (!process.env.GROQ_API_KEY) {
  logger.warn("GROQ_API_KEY is not set — chat endpoint will fail at runtime");
}

// ── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(config: {
  bizName: string;
  bizType?: string | null;
  services?: string | null;
  location?: string | null;
  howToOrder?: string | null;
  instagram?: string | null;
  personality?: string | null;
  phone?: string | null;
}): string {
  const instagramLine = config.instagram ? `\nINSTAGRAM: ${config.instagram}` : "";

  const contactRule = config.phone
    ? `- If a customer asks to contact us, book an appointment, or requests a WhatsApp link or number, always respond with exactly: You can reach us directly on WhatsApp here 👇 then on a new line include the full link: https://wa.me/${config.phone}`
    : `- If a customer asks to contact us or book an appointment, refer them to the ordering instructions above.`;

  return `You are the automated assistant for ${config.bizName}${config.bizType ? `, a ${config.bizType} business` : ""}. You do not have a personal name. Never invent a name for yourself. If asked your name, say: I'm the ${config.bizName} assistant 💕

SERVICES & PRICING:
${config.services || "Ask the owner for current pricing."}

LOCATION & AVAILABILITY:
${config.location || "Contact us for location details."}

HOW TO ORDER/BOOK:
${config.howToOrder || "Message us directly to place an order or book."}${instagramLine}

PERSONALITY: ${config.personality || "Friendly and helpful"}

STRICT RULES — follow these without exception:
- You are the ${config.bizName} assistant. Never claim to be a human or invent a name.
- Never claim to perform actions you cannot do, such as sending messages, making calls, or processing payments.
- Never confirm services or products that are not listed in your details above.
${contactRule}
- If asked something you don't know, say: Let me connect you with the owner for that
- Never make up prices or details not listed above
- Keep replies concise and natural — this is a chat, not an essay`;
}

// ── Routes ───────────────────────────────────────────────────────────────────

/** POST /chat/send — main AI reply */
router.post("/chat/send", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { messages, config } = parsed.data;

  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: "GROQ_API_KEY is not configured on the server." });
    return;
  }

  try {
    const systemPrompt = buildSystemPrompt(config);
    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const content = await groqComplete(groqMessages);
    res.json({
      content: content || "Sorry, I could not process that. Please try again.",
    });
  } catch (err) {
    if (err instanceof GroqRateLimitError) {
      req.log.warn({ err }, "Groq rate limit hit on /chat/send");
      res.json({
        content: "We're getting a lot of messages right now — please try again in a moment 🙏",
      });
      return;
    }
    req.log.error({ err }, "Groq API error");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `AI service error: ${message}` });
  }
});

/** POST /chat/summarize — generate lead summary + prefilled WhatsApp message */
router.post("/chat/summarize", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { messages, config } = parsed.data;

  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: "GROQ_API_KEY is not configured on the server." });
    return;
  }

  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const fallbackSummary = `New customer inquiry for ${config.bizName}`;

  const fallbackLead: Omit<Lead, "id" | "businessId"> = {
    timestamp: new Date().toISOString(),
    customerName: null,
    servicesInterested: [],
    bookingIntent: "low",
    questionsAsked: [],
    conversationLength: userMsgCount,
    summaryText: fallbackSummary,
    contacted: false,
  };

  try {
    const conversationText = messages
      .map((m) => `${m.role === "user" ? "Customer" : "Assistant"}: ${m.content}`)
      .join("\n");

    const systemPrompt = `You are a lead extraction assistant for ${config.bizName}.

Given a chat conversation, extract key information and return a JSON object with EXACTLY these fields:

{
  "summaryText": "A short, natural message written in first person, as if the customer typed it themselves on WhatsApp. Start with Hi! Mention what they are interested in and any questions they had. Sound friendly and human — no headers, no bullet points, no markdown, no structured labels. 2–3 sentences max. Example: Hi! I was chatting with your assistant and I am interested in lace cleaning and restyling. Wanted to ask about pricing and availability 😊",
  "customerName": "string or null",
  "servicesInterested": ["array of strings"],
  "bookingIntent": "low or medium or high",
  "questionsAsked": ["array of strings"]
}

Rules:
- summaryText must sound like a real person wrote it — casual, warm, first-person
- bookingIntent: "high" = wants to book now, "medium" = interested/asking about booking, "low" = just browsing/asking questions
- If no service is mentioned, use ["General inquiry"]
- Output valid JSON only. No markdown fences, no explanation.`;

    const raw = await groqComplete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Conversation:\n${conversationText}` },
      ],
      { maxTokens: 600, temperature: 0.3, jsonMode: true },
    );

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const validIntents = new Set<BookingIntent>(["low", "medium", "high"]);
    const rawIntent = parsed.bookingIntent as string;
    const bookingIntent: BookingIntent = validIntents.has(rawIntent as BookingIntent)
      ? (rawIntent as BookingIntent)
      : "low";

    const leadData: Omit<Lead, "id" | "businessId"> = {
      timestamp: new Date().toISOString(),
      customerName: typeof parsed.customerName === "string" ? parsed.customerName : null,
      servicesInterested: Array.isArray(parsed.servicesInterested)
        ? (parsed.servicesInterested as string[])
        : [],
      bookingIntent,
      questionsAsked: Array.isArray(parsed.questionsAsked)
        ? (parsed.questionsAsked as string[])
        : [],
      conversationLength: userMsgCount,
      summaryText:
        typeof parsed.summaryText === "string" && parsed.summaryText.trim()
          ? parsed.summaryText.trim()
          : fallbackSummary,
      contacted: false,
    };

    res.json(leadData);
  } catch (err) {
    if (err instanceof GroqRateLimitError) {
      req.log.warn({ err }, "Groq rate limit hit on /chat/summarize — using fallback lead");
    } else {
      req.log.error({ err }, "Summarize API error — using fallback");
    }
    res.json(fallbackLead);
  }
});

/** POST /chat/ping — fire-and-forget message event counter (no content stored) */
router.post("/chat/ping", async (req, res): Promise<void> => {
  const { businessId } = req.body as { businessId?: unknown };
  if (typeof businessId !== "string" || !businessId.trim()) {
    res.status(400).json({ error: "businessId is required" });
    return;
  }
  try {
    await pool.query(
      "INSERT INTO message_events (id, business_id) VALUES ($1, $2)",
      [randomUUID(), businessId.trim()],
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.warn({ err }, "chat/ping: failed to record message event");
    res.status(500).json({ error: "Failed to record event" });
  }
});

export { Lead };
export default router;
