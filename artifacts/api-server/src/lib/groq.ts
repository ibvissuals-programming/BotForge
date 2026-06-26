import { logger } from "./logger";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

if (!process.env.GROQ_API_KEY) {
  logger.warn("GROQ_API_KEY is not set — Groq endpoints will fail at runtime");
}

export interface GroqOptions {
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

/**
 * Send a chat-completion request to Groq and return the assistant's reply text.
 *
 * Throws on non-2xx responses so callers can handle errors uniformly.
 */
export async function groqComplete(
  messages: object[],
  options: GroqOptions = {},
): Promise<string> {
  const { maxTokens = 400, temperature = 0.8, jsonMode = false } = options;

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
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

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content?.trim() ?? "";
}
