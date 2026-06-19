import { Router, type IRouter } from "express";
import { SendChatMessageBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

if (!process.env.GROQ_API_KEY) {
  logger.warn("GROQ_API_KEY is not set — chat endpoint will fail at runtime");
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface Lead {
  customerName: string | null;
  servicesInterested: string[];
  questionsAsked: string[];
  bookingIntent: boolean;
  conversationLength: number;
  timestamp: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(config: {
  bizName: string;
  bizType?: string | null;
  services?: string | null;
  location?: string | null;
  howToOrder?: string | null;
  instagram?: string | null;
  personality?: string | null;
}): string {
  const instagramLine = config.instagram
    ? `\nINSTAGRAM: ${config.instagram}`
    : "";

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
- Never confirm services that are not listed in your details above.
- ${config.bizName} provides wig SERVICES only (washing, cleaning, restyling, repairs). It does NOT sell wigs. If asked about buying or purchasing wigs, say: We don't sell wigs — we only provide wig care and styling services 😊
- If a customer asks to contact Fortune, book an appointment, or requests a WhatsApp link or number, always respond with exactly: You can reach Fortune directly on WhatsApp here 👇 then on a new line include the full link: https://wa.me/2348163716199
- If asked something you don't know, say: Let me connect you with the owner for that
- Never make up prices or details not listed above
- Keep replies concise and natural — this is a chat, not an essay`;
}

async function groqFetch(messages: object[], maxTokens = 400, temperature = 0.8, jsonMode = false) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /chat/send — main chat reply
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

    const content = await groqFetch(groqMessages);
    res.json({ content: content || "Sorry, I could not process that. Please try again." });
  } catch (err) {
    req.log.error({ err }, "Groq API error");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `AI service error: ${message}` });
  }
});

// POST /chat/summarize — generate lead summary + prefilled WhatsApp message
router.post("/chat/summarize", async (req, res): Promise<void> => {
  const { messages, config } = req.body as {
    messages: Array<{ role: string; content: string }>;
    config: { bizName: string; bizType?: string };
  };

  if (!Array.isArray(messages) || !config?.bizName) {
    res.status(400).json({ error: "messages array and config.bizName are required" });
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: "GROQ_API_KEY is not configured on the server." });
    return;
  }

  const userMsgCount = messages.filter((m) => m.role === "user").length;

  // Fallback lead used if Groq fails
  const fallbackLead: Lead = {
    customerName: null,
    servicesInterested: [],
    questionsAsked: [],
    bookingIntent: false,
    conversationLength: userMsgCount,
    timestamp: new Date().toISOString(),
  };

  const fallbackText = `New customer inquiry for ${config.bizName}`;

  try {
    const conversationText = messages
      .map((m) => `${m.role === "user" ? "Customer" : "Assistant"}: ${m.content}`)
      .join("\n");

    const systemPrompt = `You are a lead extraction assistant for ${config.bizName}.

Given a chat conversation between a customer and a business assistant, extract key information and return a single JSON object with these exact fields:

{
  "whatsappText": "A formatted pre-fill message the customer will send to the business owner on WhatsApp. Use this structure (keep it concise):\n*New Inquiry – ${config.bizName}*\n\nInterested In:\n• [service 1]\n• [service 2 or N/A]\n\nQuestions Asked:\n• [main question 1]\n• [main question 2 or N/A]\n\nReady to Book: [Yes / Not yet / Unknown]\n\n_Sent via ${config.bizName} chatbot_ 👇",
  "customerName": "string or null",
  "servicesInterested": ["array", "of", "strings"],
  "questionsAsked": ["array", "of", "strings"],
  "bookingIntent": true or false
}

Rules:
- Output valid JSON only. No markdown fences, no extra keys, no explanation.
- If no clear service is mentioned, use ["General inquiry"].
- Keep the whatsappText human and natural — the customer is the one sending it.`;

    const raw = await groqFetch(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Conversation:\n${conversationText}` },
      ],
      600,
      0.3,
      true,
    );

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const lead: Lead = {
      customerName: (parsed.customerName as string | null) ?? null,
      servicesInterested: Array.isArray(parsed.servicesInterested)
        ? (parsed.servicesInterested as string[])
        : [],
      questionsAsked: Array.isArray(parsed.questionsAsked)
        ? (parsed.questionsAsked as string[])
        : [],
      bookingIntent: Boolean(parsed.bookingIntent),
      conversationLength: userMsgCount,
      timestamp: new Date().toISOString(),
    };

    const whatsappText =
      typeof parsed.whatsappText === "string" && parsed.whatsappText.trim()
        ? parsed.whatsappText.trim()
        : fallbackText;

    res.json({ whatsappText, lead });
  } catch (err) {
    req.log.error({ err }, "Summarize API error — using fallback");
    res.json({ whatsappText: fallbackText, lead: fallbackLead });
  }
});

export default router;
