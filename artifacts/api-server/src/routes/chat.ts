import { Router, type IRouter } from "express";
import { SendChatMessageBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

if (!process.env.GROQ_API_KEY) {
  logger.warn("GROQ_API_KEY is not set — chat endpoint will fail at runtime");
}

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
- If asked about anything outside your listed services, say: I can only help with ${config.bizName} wig services 😊
- If asked something you don't know, say: Let me connect you with the owner for that
- Never make up prices or details not listed above
- Keep replies concise and natural — this is a chat, not an essay`;
}

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

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: groqMessages,
        max_tokens: 400,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText);
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const content = data.choices[0]?.message?.content ?? "Sorry, I could not process that. Please try again.";

    res.json({ content });
  } catch (err) {
    req.log.error({ err }, "Groq API error");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `AI service error: ${message}` });
  }
});

export default router;
