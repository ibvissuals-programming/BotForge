import { Pool } from "pg";
import { logger } from "./logger";

// ── Schema ────────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS businesses (
    id           TEXT PRIMARY KEY,
    biz_name     TEXT        NOT NULL,
    biz_type     TEXT        NOT NULL,
    phone        TEXT,
    services     TEXT,
    location     TEXT,
    how_to_order TEXT,
    instagram    TEXT,
    personality  TEXT,
    welcome_msg  TEXT,
    accent_color TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS leads (
    id                  TEXT        PRIMARY KEY,
    business_id         TEXT        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    timestamp           TIMESTAMPTZ NOT NULL,
    customer_name       TEXT,
    services_interested TEXT[]      NOT NULL DEFAULT '{}',
    booking_intent      TEXT        NOT NULL DEFAULT 'low',
    questions_asked     TEXT[]      NOT NULL DEFAULT '{}',
    conversation_length INT         NOT NULL DEFAULT 0,
    summary_text        TEXT        NOT NULL DEFAULT '',
    contacted           BOOLEAN     NOT NULL DEFAULT FALSE
  );
  -- idempotent: add contacted column if upgrading from an older schema
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS contacted BOOLEAN NOT NULL DEFAULT FALSE;
  -- idempotent: add slug column for clean shareable chatbot URLs
  ALTER TABLE businesses ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
  -- idempotent: track old slugs so renamed businesses keep working at their old URL
  ALTER TABLE businesses ADD COLUMN IF NOT EXISTS previous_slugs TEXT[] NOT NULL DEFAULT '{}';
  -- idempotent: add note column for admin follow-up memos
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS note TEXT;
  -- idempotent: lightweight message event log — one row per AI reply, no content stored
  CREATE TABLE IF NOT EXISTS message_events (
    id          TEXT        PRIMARY KEY,
    business_id TEXT        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  -- idempotent: chatbot page colour theme ('dark' | 'light')
  ALTER TABLE businesses ADD COLUMN IF NOT EXISTS background_theme TEXT NOT NULL DEFAULT 'dark';
  -- idempotent: optional JSON hex palette for light-theme businesses
  ALTER TABLE businesses ADD COLUMN IF NOT EXISTS light_theme_palette TEXT;
  -- idempotent: 'plain' = generic white/black, 'branded' = apply lightThemePalette
  ALTER TABLE businesses ADD COLUMN IF NOT EXISTS light_theme_style TEXT NOT NULL DEFAULT 'plain';
  -- idempotent: filename of the per-business Open Graph preview image (e.g. 'fortune.jpg')
  ALTER TABLE businesses ADD COLUMN IF NOT EXISTS og_image_filename TEXT;
`;

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_BUSINESSES = [
  {
    id: "styled-by-fortune",
    slug: "styledbyfortune",
    previousSlugs: ["fortune"],
    bizName: "Styled By Fortune",
    bizType: "wig",
    phone: "2348163716199",
    services: [
      "Washing & Deep Conditioning — ₦2,500",
      "Lace Cleaning — ₦1,500",
      "Restyling Straight — ₦2,500",
      "Restyling Waves — ₦2,500",
      "Restyling Curls — ₦3,000",
      "Ultimate Revamp All-in-One — ₦7,000",
      "Elastic Band Replacement — ₦800",
    ].join("\n"),
    location: "Port Harcourt, Rivers State",
    howToOrder: "Call or DM 08163716199",
    instagram: "@styled_by_fortune",
    personality: "Warm, glamorous, uses emojis, energetic and encouraging",
    welcomeMsg:
      "Got questions beyond what's above? Ask me anything about booking, timing, or your specific hair needs! 💕",
    accentColor: "#b5517a",
    backgroundTheme: "dark",
    lightThemePalette: null as string | null,
    lightThemeStyle: "plain",
    ogImageFilename: "fortune.jpg",
  },
  {
    id: "rossy-cakes-events-management",
    slug: "rossyevents",
    previousSlugs: ["rossy"],
    bizName: "Rossy Cakes & Events Management",
    bizType: "cake",
    phone: "2348066539706",
    services: [
      "Tagline: Making your moments sweeter and more memorable",
      "",
      "CAKE PRICE LIST (prices are per layer, in Naira):",
      "Bento Cake (4\") — ₦10,000",
      "Bento Cake (5\") — ₦12,000",
      "6\" Cake — ₦6,800",
      "7\" Cake — ₦7,500",
      "8\" Cake — ₦12,000",
      "10\" Cake — ₦27,500",
      "12\" Cake — ₦42,000",
      "14\" Cake — ₦55,000",
      "",
      "Custom designs are available. All cakes are freshly baked with quality ingredients. Orders should be placed in advance.",
      "",
      "CHOPS AND SNACKS (prices are per piece unless noted):",
      "Samosa — ₦400",
      "Spring roll — ₦400",
      "Puff — ₦150",
      "Peppered Chicken — Small ₦1,500 / Medium ₦2,500 / Large ₦3,500",
      "Peppered Beef — Single ₦500 / Kebab ₦2,000",
      "Meatpie — Regular ₦1,500 / Small ₦800",
      "Sausage roll — ₦1,200",
      "Doughnut — ₦800",
      "Chinchin — ₦22,000 (Rubber)",
      "Egg roll — ₦700",
      "Banana bread — Mini's pack of four ₦5,500 / Midi size ₦6,000 / Maxi size ₦10,000",
      "Buttercream cupcake (Piping only) – Box of 6 — ₦8,000",
      "Buttercream Cupcake (With extra designs) – Box of 6 — ₦10,000",
      "Peppered sausage (1) — ₦800",
      "Money bag — ₦600",
      "Chicken Pie — ₦2,000",
      "Fishroll — ₦2,000",
    ].join("\n"),
    location: "33 Rumuchika Street, Mgbuakara, Off Elioparanwo Road",
    howToOrder: "Call or WhatsApp 08066539706 to place your order. Please order in advance and share your design ideas if you want a custom cake.",
    instagram: null,
    personality: "Warm, celebratory, and helpful. Excited about making special moments memorable. Uses friendly, encouraging language.",
    welcomeMsg:
      "Have a question about our cakes or events? Ask me anything — let's make your moment sweeter! 🎂",
    accentColor: "#c9a45a",
    backgroundTheme: "light",
    lightThemePalette: JSON.stringify({
      background: "#fdf4ee",
      foreground: "#3d1520",
      card: "#ffffff",
      cardBorder: "#c9a45a",
      border: "#c9a45a",
      muted: "#f5e6dc",
      mutedForeground: "#7a3040",
      primary: "#8b1a2e",
      primaryForeground: "#ffffff",
      input: "#fceae2",
      ring: "#c9a45a",
    }),
    lightThemeStyle: "branded",
    ogImageFilename: "rossy.jpg",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    // Fail immediately with a clear message instead of hanging
    throw new Error(
      "DATABASE_URL is not set — cannot run DB migrations. " +
      "Add it in Replit Secrets (dev) or the Deployment secrets panel (production)."
    );
  }

  // connect_timeout=15 sets the PostgreSQL protocol-level TCP socket timeout.
  // connectionTimeoutMillis only controls pool-queue wait time, NOT the TCP
  // handshake — so it doesn't help when the host is silently unreachable.
  // Adding connect_timeout to the URL is the correct low-level fix.
  const dbUrlWithTimeout = dbUrl.includes("?")
    ? `${dbUrl}&connect_timeout=15`
    : `${dbUrl}?connect_timeout=15`;

  const pool = new Pool({
    connectionString: dbUrlWithTimeout,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    max: 3,
  });

  const client = await pool.connect();
  try {
    // 1. Create tables (idempotent — IF NOT EXISTS)
    logger.info("DB migration: ensuring schema …");
    await client.query(SCHEMA_SQL);
    logger.info("DB migration: schema ready ✅");

    // 2. Seed default businesses — idempotent per-row via ON CONFLICT DO NOTHING.
    //    Runs every boot so new seed entries are added to existing databases
    //    without disrupting data already present.
    logger.info("DB migration: seeding default businesses …");
    for (const biz of SEED_BUSINESSES) {
      const result = await client.query(
        `INSERT INTO businesses
           (id, biz_name, biz_type, phone, services, location, how_to_order,
            instagram, personality, welcome_msg, accent_color, slug, previous_slugs,
            background_theme, light_theme_palette, light_theme_style, og_image_filename)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id) DO UPDATE
           SET og_image_filename = EXCLUDED.og_image_filename
           WHERE businesses.og_image_filename IS NULL
              OR businesses.og_image_filename = ''`,
        [
          biz.id,
          biz.bizName,
          biz.bizType,
          biz.phone,
          biz.services,
          biz.location,
          biz.howToOrder,
          biz.instagram,
          biz.personality,
          biz.welcomeMsg,
          biz.accentColor,
          biz.slug,
          biz.previousSlugs ?? [],
          biz.backgroundTheme ?? "dark",
          biz.lightThemePalette ?? null,
          biz.lightThemeStyle ?? "plain",
          biz.ogImageFilename ?? null,
        ]
      );
      if ((result.rowCount ?? 0) > 0) {
        logger.info({ id: biz.id, name: biz.bizName }, "DB migration: seeded business ✅");
      } else {
        logger.info({ id: biz.id }, "DB migration: business already exists — skipped ✅");
      }
    }
    logger.info("DB migration: seed complete ✅");

    // 3. Backfill light_theme_style for businesses that predate the column.
    //    Any business that already has a palette set is implicitly "branded" —
    //    flip only rows still sitting at the default 'plain' that have a palette.
    try {
      await client.query(`
        UPDATE businesses
        SET light_theme_style = 'branded'
        WHERE light_theme_palette IS NOT NULL
          AND light_theme_style = 'plain'
      `);
      logger.info("DB migration: light_theme_style backfill complete ✅");
    } catch (err) {
      logger.warn({ err }, "DB migration: light_theme_style backfill failed");
    }

    // 4. Backfill og_image_filename for the two known seed businesses that
    //    predate this column — only updates rows where the column is still NULL.
    try {
      await client.query(`
        UPDATE businesses
        SET og_image_filename = CASE
          WHEN id = 'styled-by-fortune'             THEN 'fortune.jpg'
          WHEN id = 'rossy-cakes-events-management' THEN 'rossy.jpg'
          ELSE og_image_filename
        END
        WHERE id IN ('styled-by-fortune', 'rossy-cakes-events-management')
          AND (og_image_filename IS NULL OR og_image_filename = '')
      `);
      logger.info("DB migration: og_image_filename backfill complete ✅");
    } catch (err) {
      logger.warn({ err }, "DB migration: og_image_filename backfill failed");
    }

    // 5. Backfill slugs for any businesses that predate the slug column.
    //    Uses explicit slugs for the two known seed businesses, and derives
    //    from the first word of bizName for any others.
    //    Wrapped in try/catch so a uniqueness conflict on an edge-case
    //    install doesn't crash the boot sequence.
    try {
      await client.query(`
        UPDATE businesses
        SET slug = CASE
          WHEN id = 'styled-by-fortune'              THEN 'styledbyfortune'
          WHEN id = 'rossy-cakes-events-management'  THEN 'rossyevents'
          ELSE lower(regexp_replace(split_part(biz_name, ' ', 1), '[^a-z0-9]', '', 'g'))
        END
        WHERE slug IS NULL
      `);
      logger.info("DB migration: slug backfill complete ✅");
    } catch (err) {
      logger.warn({ err }, "DB migration: slug backfill had conflicts — some businesses may have NULL slug");
    }
  } finally {
    client.release();
    await pool.end();
  }
}
