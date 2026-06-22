#!/usr/bin/env node
/**
 * Standalone secrets checklist — run with: pnpm run secrets:check
 *
 * Safe to run at any time without starting the server.
 * Exits with code 1 if any required secret is missing OR if DATABASE_URL
 * contains an internal-only hostname that will fail in production.
 */

const SECRETS = [
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

// ── Internal-hostname guard ───────────────────────────────────────────────────
//
// Replit dev sets DATABASE_URL with "helium" (or similar single-label
// hostnames) that only resolve inside the dev container network.
// Running this check before a deploy catches the misconfiguration early.

const KNOWN_DEV_HOSTS = new Set(["helium", "neon-proxy", "db", "postgres", "database"]);

function detectInternalDbHost(rawUrl) {
  let host;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    return null;
  }

  if (!host) return null;

  if (KNOWN_DEV_HOSTS.has(host.toLowerCase())) {
    return `"${host}" is a Replit dev-container hostname — unreachable from production`;
  }

  const isIp = /^[\d.:]+$/.test(host);
  if (!isIp && !host.includes(".")) {
    return `"${host}" is a single-label hostname — only resolvable inside a container network`;
  }

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return `"${host}" is a loopback address — only reachable on the same machine`;
  }

  const rfc1918 =
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
  if (rfc1918) {
    return `"${host}" is a private/RFC-1918 address — likely unreachable from Replit's production network`;
  }

  return null;
}

// ── Run checklist ─────────────────────────────────────────────────────────────

const LINE = "─".repeat(62);
const missing = [];

console.log(LINE);
console.log("  BOTFORGE — SECRETS CHECKLIST");
console.log(LINE);

for (const secret of SECRETS) {
  const present = Boolean(process.env[secret.key]);

  if (present) {
    console.log(`  ✅  ${secret.key}`);
  } else {
    missing.push(secret);
    console.error(`  ❌  ${secret.key}  —  ${secret.description}`);
    console.error(`       ↳ How to get: ${secret.howToGet}`);
  }
}

console.log(LINE);

// ── Hostname guard ────────────────────────────────────────────────────────────

const dbUrl = process.env.DATABASE_URL;
let hostnameWarning = null;

if (dbUrl) {
  hostnameWarning = detectInternalDbHost(dbUrl);
  if (hostnameWarning) {
    console.error(LINE);
    console.error("  ⚠️   DATABASE_URL HOSTNAME WARNING");
    console.error(LINE);
    console.error(`  ${hostnameWarning}`);
    console.error("  This URL works in dev but will cause a silent TCP hang");
    console.error("  on startup in the deployed (production) app.");
    console.error("  Fix: set DATABASE_URL in Deployments → Secrets using");
    console.error("  the external connection string from the PostgreSQL");
    console.error("  integration (not the internal dev URL).");
    console.error(LINE);
  }
}

// ── Final verdict ─────────────────────────────────────────────────────────────

if (missing.length === 0 && !hostnameWarning) {
  console.log("  All secrets present — server fully operational ✅");
  console.log(LINE);
  process.exit(0);
} else {
  if (missing.length > 0) {
    console.error(
      `  ${missing.length} secret(s) missing — affected features will fail at runtime`
    );
    console.error(
      "  Add them in the Replit sidebar → Secrets (🔒 icon) then restart the server"
    );
  }
  if (hostnameWarning) {
    console.error("  DATABASE_URL hostname is not safe for production — see warning above");
  }
  console.log(LINE);
  process.exit(1);
}
