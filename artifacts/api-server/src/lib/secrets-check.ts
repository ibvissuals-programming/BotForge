import { logger } from "./logger";

// ── Secret registry ───────────────────────────────────────────────────────────
//
// Every secret this project needs is declared here.
// On startup this list is printed in full so a fresh importer can see exactly
// what to add — no more discovering missing secrets through broken features.

interface SecretSpec {
  key: string;
  description: string;
  howToGet: string;
}

const SECRETS: SecretSpec[] = [
  {
    key: "GROQ_API_KEY",
    description: "Powers all AI chat responses via Groq's LLM API",
    howToGet: "Free key at https://console.groq.com → API Keys",
  },
  {
    key: "BOTFORGE_CEO_PASSWORD",
    description: "Password for the admin dashboard (/admin)",
    howToGet: "Set any strong password of your choice in Secrets",
  },
  {
    key: "DATABASE_URL",
    description: "PostgreSQL connection string — stores leads & businesses",
    howToGet:
      "Add Replit's PostgreSQL integration (sidebar → Integrations → PostgreSQL) — it sets DATABASE_URL automatically",
  },
];

const LINE = "─".repeat(62);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run at process start. Logs every required secret with ✅/❌ status and
 * instructions for any that are missing. Never throws — a missing secret is
 * a warning, not a crash (features degrade gracefully per-route).
 */
export function runSecretsCheck(): void {
  const missing: SecretSpec[] = [];

  logger.info(LINE);
  logger.info("  BOTFORGE — SECRETS CHECKLIST");
  logger.info(LINE);

  for (const secret of SECRETS) {
    const present = Boolean(process.env[secret.key]);

    if (present) {
      logger.info(`  ✅  ${secret.key}`);
    } else {
      missing.push(secret);
      logger.warn(`  ❌  ${secret.key}  —  ${secret.description}`);
      logger.warn(`       ↳ How to get: ${secret.howToGet}`);
    }
  }

  logger.info(LINE);

  if (missing.length === 0) {
    logger.info("  All secrets present — server fully operational ✅");
  } else {
    logger.warn(
      `  ${missing.length} secret(s) missing — affected features will fail at runtime`,
    );
    logger.warn(
      "  Add them in the Replit sidebar → Secrets (🔒 icon) then restart the server",
    );
  }

  logger.info(LINE);
}
