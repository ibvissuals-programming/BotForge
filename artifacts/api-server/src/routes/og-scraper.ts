import { Router, type IRouter } from "express";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Known social-media / link-preview scraper user-agent substrings.
// These bots need server-rendered OG meta tags — real browsers get
// the React SPA from the chatbot Vite server (dev) or static dist (production).
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
  const lower = ua.toLowerCase();
  return SCRAPER_PATTERNS.some((p) => lower.includes(p));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── GET /:slug — serve OG-enriched HTML to link-preview scrapers ───────────────
//
// Only responds when the User-Agent is a known scraper.  Real browsers call
// next() and receive a 404 from Express (they load the SPA from port 3000 in
// dev, or from the chatbot OG server in production — this route is purely for
// curl / bot verification and as a fallback).

router.get("/:slug", async (req, res, next): Promise<void> => {
  const ua = req.headers["user-agent"] ?? "";
  if (!isScraperUA(ua)) {
    next();
    return;
  }

  const { slug } = req.params;

  // Skip well-known static asset paths that would never be a business slug.
  const STATIC_PATHS = new Set([
    "favicon.png", "favicon.svg", "icon-192.png", "icon-512.png",
    "manifest.json", "robots.txt", "opengraph.jpg",
  ]);
  if (STATIC_PATHS.has(slug)) {
    next();
    return;
  }

  try {
    const result = await pool.query(
      `SELECT * FROM businesses
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

    // Use the first non-blank line of services as the OG description.
    const description =
      services.split("\n").find((l) => l.trim().length > 0)?.trim() ??
      "AI-powered business chatbot — built by BotForge";

    // Build absolute base URL from forwarded headers (Replit proxy sets these).
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

    const pageUrl = `${baseUrl}/${slug}`;

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
<meta property="og:url" content="${escapeHtml(pageUrl)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(bizName)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
</head>
<body></body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    logger.error({ err, slug }, "OG scraper: DB lookup failed");
    next(err);
  }
});

export default router;
