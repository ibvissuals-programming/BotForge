import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/requireAdmin";
import { groqComplete } from "../lib/groq";

const router: IRouter = Router();

function buildPromoPrompt(biz: {
  bizName: string;
  bizType?: string | null;
  services?: string | null;
  location?: string | null;
  personality?: string | null;
}): string {
  return `You are a social media content expert for Nigerian small businesses.

Write ONE scroll-stopping social media caption for ${biz.bizName}, a ${biz.bizType ?? "small"} business.

Business details:
- Services: ${biz.services ?? "Not specified"}
- Location: ${biz.location ?? "Nigeria"}
- Tone/Personality: ${biz.personality ?? "Friendly and professional"}

Rules:
- Maximum 3 short, punchy sentences
- Feel authentic and relatable to a Nigerian audience
- Use relevant emojis naturally
- End with a clear call to action (DM, call, or visit)
- Do NOT use hashtags
- Be specific to their actual services listed above — don't be generic
- Make it feel like something a real business owner would post, not corporate copy

Return ONLY the caption text. No intro, no label, no explanation — just the caption.`;
}

/** POST /promo/generate — admin only */
router.post("/promo/generate", requireAdmin, async (req, res): Promise<void> => {
  const { bizName, bizType, services, location, personality } = req.body as {
    bizName?: string;
    bizType?: string;
    services?: string;
    location?: string;
    personality?: string;
  };

  if (!bizName?.trim()) {
    res.status(400).json({ error: "bizName is required" });
    return;
  }

  try {
    const caption = await groqComplete(
      [
        {
          role: "user",
          content: buildPromoPrompt({ bizName, bizType, services, location, personality }),
        },
      ],
      { maxTokens: 300, temperature: 0.9 },
    );

    logger.info({ bizName }, "promo caption generated");
    res.json({ caption: caption.trim() });
  } catch (err) {
    logger.error({ err }, "Failed to generate promo caption");
    res.status(500).json({ error: "Failed to generate caption. Please try again." });
  }
});

export default router;
