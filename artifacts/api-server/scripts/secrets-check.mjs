#!/usr/bin/env node
/**
 * Standalone secrets checklist — run with: pnpm run secrets:check
 *
 * Safe to run at any time without starting the server.
 * Exits with code 1 if any required secret is missing.
 *
 * NOTE: This script does NOT validate the DATABASE_URL hostname.
 * In the production build environment Replit injects its own production
 * DATABASE_URL automatically — we cannot know its format and must trust it.
 * Hostname-shape validation lives in lib/secrets-check.ts as a runtime
 * warning (logged on dev server boot only, never blocks production).
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

if (missing.length === 0) {
  console.log("  All secrets present — server fully operational ✅");
  console.log(LINE);
  process.exit(0);
} else {
  console.error(
    `  ${missing.length} secret(s) missing — affected features will fail at runtime`
  );
  console.error(
    "  Add them in Replit → Deployments → Secrets then redeploy"
  );
  console.log(LINE);
  process.exit(1);
}
