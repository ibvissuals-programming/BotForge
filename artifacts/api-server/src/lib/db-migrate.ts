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
`;

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_BUSINESSES = [
  {
    id: "styled-by-fortune",
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

    // 2. Seed only when the businesses table is completely empty
    const { rows } = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM businesses"
    );
    const count = parseInt(rows[0]?.count ?? "0", 10);

    if (count === 0) {
      logger.info("DB migration: businesses table empty — seeding defaults …");

      for (const biz of SEED_BUSINESSES) {
        await client.query(
          `INSERT INTO businesses
             (id, biz_name, biz_type, phone, services, location, how_to_order,
              instagram, personality, welcome_msg, accent_color)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO NOTHING`,
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
          ]
        );
        logger.info({ id: biz.id, name: biz.bizName }, "DB migration: seeded business ✅");
      }

      logger.info("DB migration: seed complete ✅");
    } else {
      logger.info(
        { existingCount: count },
        "DB migration: businesses table not empty — skipping seed ✅"
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}
