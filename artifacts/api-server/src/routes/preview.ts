import { Router, type IRouter } from "express";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SCRAPER_PATTERNS = [
  "facebookexternalhit",
  "facebookcatalog",
  "whatsapp",
  "twitterbot",
  "linkedinbot",
  "telegrambot",
  "slackbot",
  "googlebot",
  "bingbot",
  "applebot",
  "discordbot",
  "vkshare",
  "line-poker",
  "iframely",
];

function isScraperUA(ua: string): boolean {
  return SCRAPER_PATTERNS.some((p) => ua.toLowerCase().includes(p));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * GET /api/preview/:slug
 *
 * Returns an OG-enriched HTML page for the given business slug.
 * This route lives under /api so Replit's platform proxy routes it to the
 * API server — the static chatbot handler never sees these requests.
 *
 * Scrapers (WhatsApp, Twitter, etc.) receive only the OG meta tags and stop.
 * Real browsers receive the same OG tags plus a JavaScript redirect to /<slug>
 * so the React SPA loads at the canonical chatbot URL.
 */
router.get("/preview/:slug", async (req, res, next): Promise<void> => {
  const { slug } = req.params;

  try {
    const result = await pool.query(
      `SELECT biz_name, services, og_image_filename
       FROM businesses
       WHERE slug = $1 OR $1 = ANY(COALESCE(previous_slugs, '{}'))
       LIMIT 1`,
      [slug],
    );

    if (result.rows.length === 0) {
      res.status(404).end();
      return;
    }

    const row = result.rows[0] as Record<string, unknown>;
    const bizName = (row.biz_name as string) ?? "BotForge";
    const services = (row.services as string | null) ?? "";
    const ogImageFilename = (row.og_image_filename as string | null) ?? null;

    const description =
      services.split("\n").find((l) => l.trim().length > 0)?.trim() ??
      "AI-powered business chatbot — built by BotForge";

    const proto =
      (req.headers["x-forwarded-proto"] as string | undefined) ??
      req.protocol ??
      "https";
    const host =
      (req.headers["x-forwarded-host"] as string | undefined) ??
      req.get("host") ??
      "localhost";
    const baseUrl = `${proto}://${host}`;

    const imageUrl = ogImageFilename
      ? `${baseUrl}/og/${ogImageFilename}`
      : `${baseUrl}/opengraph.jpg`;

    const canonicalUrl = `${baseUrl}/${slug}`;
    const ua = req.headers["user-agent"] ?? "";
    const scraper = isScraperUA(ua);

    const redirectScript = scraper
      ? ""
      : `<script>window.location.replace(${JSON.stringify(canonicalUrl)});</script>\n`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(bizName)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:title" content="${escapeHtml(bizName)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(imageUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(bizName)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
${redirectScript}</head>
<body></body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    logger.error({ err, slug }, "preview: DB lookup failed");
    next(err);
  }
});

export default router;
