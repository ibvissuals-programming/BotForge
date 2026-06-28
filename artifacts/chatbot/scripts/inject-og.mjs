/**
 * inject-og.mjs — post-build Open Graph injection
 *
 * Reads the Vite-generated dist/public/index.html and creates per-business
 * slug directories (dist/public/<slug>/index.html) with the correct OG meta
 * tags injected.  Replit's static file handler serves directory index files,
 * so a request to /<slug> gets the enriched HTML; scrapers (WhatsApp, etc.)
 * read the correct og:title and og:image before the React app even boots.
 *
 * Add new businesses to the BUSINESSES array below whenever a new client is
 * onboarded and has a branded OG image.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "../dist/public");

// Production base URL — used to build absolute og:image and og:url values.
// Update this if the app is ever moved to a custom domain.
const BASE_URL = "https://bot-forge--xcoderib.replit.app";

const BUSINESSES = [
  {
    slug: "styledbyfortune",
    name: "Styled By Fortune",
    description: "Washing & Deep Conditioning — ₦2,500",
    ogImage: `${BASE_URL}/og/fortune.jpg`,
  },
  {
    slug: "rossyevents",
    name: "Rossy Cakes & Events Management",
    description: "Making your moments sweeter and more memorable",
    ogImage: `${BASE_URL}/og/rossy.jpg`,
  },
];

function escape(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildOgBlock(biz) {
  const title = escape(biz.name);
  const desc = escape(biz.description);
  const img = escape(biz.ogImage);
  const url = escape(`${BASE_URL}/${biz.slug}`);
  return [
    `  <meta property="og:title" content="${title}" />`,
    `  <meta property="og:description" content="${desc}" />`,
    `  <meta property="og:image" content="${img}" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta property="og:type" content="website" />`,
    `  <meta property="og:url" content="${url}" />`,
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${title}" />`,
    `  <meta name="twitter:description" content="${desc}" />`,
    `  <meta name="twitter:image" content="${img}" />`,
  ].join("\n");
}

const indexHtml = fs.readFileSync(path.join(DIST, "index.html"), "utf8");

// Strip generic og: and twitter: meta tags from the base HTML so they don't
// appear before the business-specific ones.  Scrapers use the first occurrence
// of each property, so stale generic tags must be removed, not just appended.
const STRIP_OG_RE = /\s*<meta\s+(property="og:[^"]*"|name="twitter:[^"]*")[^>]*\/>\n?/gi;
const baseWithoutGenericOg = indexHtml.replace(STRIP_OG_RE, "\n");

for (const biz of BUSINESSES) {
  const ogBlock = buildOgBlock(biz);
  // Inject right before </head> — generic OG tags are already stripped above.
  const enriched = baseWithoutGenericOg.replace("</head>", `${ogBlock}\n</head>`);

  const outDir = path.join(DIST, biz.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), enriched, "utf8");
  console.log(`  og: /${biz.slug}/index.html → "${biz.name}"`);
}

console.log("inject-og: done");
