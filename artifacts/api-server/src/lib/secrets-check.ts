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

// ── Internal-hostname guard ───────────────────────────────────────────────────
//
// Replit's dev environment sets DATABASE_URL with an internal container
// hostname (e.g. "helium") that only resolves inside the dev network.
// That hostname does not exist in production — causing a silent TCP hang
// on startup. This guard detects the pattern and logs a loud warning so
// the problem is self-diagnosing rather than a mysterious "failed to start".
//
// Detection heuristics (any one triggers the warning):
//   1. Single-label hostname — no dots (e.g. "helium", "postgres", "db").
//      Real production DB hosts always have FQDNs.
//   2. Known Replit dev-container hostnames: "helium", "neon-proxy" etc.
//   3. Loopback / link-local: localhost, 127.x.x.x, ::1
//   4. RFC-1918 private ranges: 10.x, 172.16-31.x, 192.168.x
//      (flagged only in NODE_ENV=production — valid in some hosted setups)

const KNOWN_DEV_HOSTS = new Set(["helium", "neon-proxy", "db", "postgres", "database"]);

function detectInternalDbHost(rawUrl: string): string | null {
  let host: string;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    return null;
  }

  if (!host) return null;

  // 1. Known Replit dev-container hostnames
  if (KNOWN_DEV_HOSTS.has(host.toLowerCase())) {
    return `"${host}" is a Replit dev-container hostname — unreachable from production`;
  }

  // 2. Single-label hostname (no dots, not an IP)
  const isIp = /^[\d.:]+$/.test(host);
  if (!isIp && !host.includes(".")) {
    return `"${host}" is a single-label hostname — only resolvable inside a container network`;
  }

  // 3. Loopback
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return `"${host}" is a loopback address — only reachable on the same machine`;
  }

  // 4. RFC-1918 private ranges (warn only in production)
  if (process.env.NODE_ENV === "production") {
    const rfc1918 =
      /^10\.\d+\.\d+\.\d+$/.test(host) ||
      /^192\.168\.\d+\.\d+$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
    if (rfc1918) {
      return `"${host}" is a private/RFC-1918 address — likely unreachable from Replit's production network`;
    }
  }

  return null;
}

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

  // ── Internal-hostname guard ──────────────────────────────────────────────
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    const warning = detectInternalDbHost(dbUrl);
    if (warning) {
      logger.warn(LINE);
      logger.warn("  ⚠️   DATABASE_URL HOSTNAME WARNING");
      logger.warn(LINE);
      logger.warn(`  ${warning}`);
      logger.warn("  This DATABASE_URL will work in dev but will cause a");
      logger.warn("  silent TCP hang on startup in production (deployed app).");
      logger.warn("  Fix: set DATABASE_URL in Deployments → Secrets using");
      logger.warn("  the external connection string from the PostgreSQL");
      logger.warn("  integration (not the internal dev URL).");
      logger.warn(LINE);
    }
  }
}
