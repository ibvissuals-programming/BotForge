/**
 * og-server.mjs — production server for the chatbot artifact.
 *
 * Replaces the static file server so we can inject per-business Open Graph
 * meta tags before link-preview scrapers (WhatsApp, Twitter, etc.) read them.
 *
 * Behaviour:
 *   - GET /og/fortune.jpg, GET /assets/…  → serve static files from dist/public/
 *   - GET /:slug  (scraper UA)            → OG-enriched HTML for that business
 *   - Everything else                     → index.html  (React SPA fallback)
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist/public");
const PORT = Number(process.env.PORT) || 3000;
const API_BASE = "http://localhost:8080";

// ── MIME types ────────────────────────────────────────────────────────────────

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain",
};

// ── Scraper detection ─────────────────────────────────────────────────────────

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

function isScraperUA(ua) {
  const lower = (ua || "").toLowerCase();
  return SCRAPER_PATTERNS.some((p) => lower.includes(p));
}

// ── Business cache ────────────────────────────────────────────────────────────

let businessCache = [];
let cacheExpiry = 0;

function fetchBusinesses() {
  return new Promise((resolve) => {
    const req = http.get(`${API_BASE}/api/businesses`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            businessCache = parsed;
            cacheExpiry = Date.now() + 60_000; // cache for 1 min
          }
          resolve(businessCache);
        } catch {
          resolve(businessCache);
        }
      });
    });
    req.on("error", () => resolve(businessCache));
    req.setTimeout(5_000, () => {
      req.destroy();
      resolve(businessCache);
    });
  });
}

async function getBusinesses() {
  if (Date.now() < cacheExpiry) return businessCache;
  return fetchBusinesses();
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildOgHtml(biz, imageUrl, pageUrl) {
  const title = escapeHtml(biz.bizName || "BotForge");
  const description = escapeHtml(
    (biz.services || "")
      .split("\n")
      .find((l) => l.trim().length > 0)
      ?.trim() ?? "AI-powered business chatbot — built by BotForge"
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${escapeHtml(imageUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(pageUrl)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
</head>
<body></body>
</html>`;
}

// ── Static file helpers ───────────────────────────────────────────────────────

function tryServeFile(res, filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": stat.size,
      "Cache-Control": "public, max-age=3600",
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

function serveIndex(res) {
  const indexPath = path.join(DIST, "index.html");
  try {
    const content = fs.readFileSync(indexPath, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end("Internal server error");
  }
}

// ── Request handler ───────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;

  // 1. Try to serve an exact static file match first.
  const filePath = path.join(DIST, pathname);
  if (tryServeFile(res, filePath)) return;

  // 1b. Try directory-index: /<slug> → dist/public/<slug>/index.html
  //     inject-og.mjs creates these at build time with correct per-business OG
  //     tags. Serving them here means scrapers AND browsers get the enriched
  //     HTML without any cross-container localhost:8080 call at request time.
  const dirIndexPath = path.join(DIST, pathname, "index.html");
  if (tryServeFile(res, dirIndexPath)) return;

  // 2. Extract the first path segment as a potential business slug.
  const slug = pathname.replace(/^\//, "").split("/")[0];

  // 3. For known scraper user-agents on a non-empty slug, attempt OG injection.
  const ua = req.headers["user-agent"] || "";
  if (slug && isScraperUA(ua)) {
    const businesses = await getBusinesses();
    const biz = businesses.find(
      (b) =>
        b.slug === slug ||
        (Array.isArray(b.previousSlugs) && b.previousSlugs.includes(slug))
    );

    if (biz) {
      const proto =
        req.headers["x-forwarded-proto"] || "https";
      const host =
        req.headers["x-forwarded-host"] || req.headers.host || "localhost";
      const baseUrl = `${proto}://${host}`;
      const imageUrl = biz.ogImageFilename
        ? `${baseUrl}/og/${biz.ogImageFilename}`
        : `${baseUrl}/opengraph.jpg`;
      const pageUrl = `${baseUrl}/${slug}`;

      const html = buildOgHtml(biz, imageUrl, pageUrl);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
  }

  // 4. SPA fallback: serve index.html for all other requests.
  serveIndex(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Chatbot OG server listening on port ${PORT}`);
});
