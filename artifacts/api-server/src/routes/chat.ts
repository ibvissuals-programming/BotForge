import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";
import { SendChatMessageBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

if (!process.env.GEMINI_API_KEY) {
  logger.warn("GEMINI_API_KEY is not set — chat endpoint will fail at runtime");
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

  return `You are a customer service assistant for ${config.bizName}${config.bizType ? `, a ${config.bizType} business` : ""}.

SERVICES & PRICING:
${config.services || "Ask the owner for current pricing."}

LOCATION & AVAILABILITY:
${config.location || "Contact us for location details."}

HOW TO ORDER/BOOK:
${config.howToOrder || "Message us directly to place an order or book."}${instagramLine}

PERSONALITY: ${config.personality || "Friendly and helpful"}

RULES:
- Always stay in character as ${config.bizName}'s assistant
- Be warm, helpful and conversational
- If asked something you don't know, say "Let me connect you with the owner for that"
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

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const systemInstruction = buildSystemPrompt(config);

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: 400,
        temperature: 0.8,
      },
    });

    const content = response.text ?? "Sorry, I could not process that. Please try again.";

    res.json({ content });
  } catch (err) {
    req.log.error({ err }, "Gemini API error");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `AI service error: ${message}` });
  }
});

export default router;
