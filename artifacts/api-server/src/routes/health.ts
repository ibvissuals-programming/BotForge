import { Router, type IRouter } from "express";
import { Pool } from "pg";
import { requireAdmin } from "../middlewares/requireAdmin";
import { pool as sharedPool } from "../lib/db";

const router: IRouter = Router();

const BOOT_TIME = Date.now();

const REQUIRED_SECRETS = [
  { key: "GROQ_API_KEY",           label: "Groq AI (chat + promo)" },
  { key: "BOTFORGE_CEO_PASSWORD",  label: "Admin dashboard password" },
  { key: "DATABASE_URL",           label: "PostgreSQL database" },
];

// ── Startup probe — used by Replit deployment healthcheck ─────────────────────
//
// Returns 200 only when the server AND the database are both reachable.
// The deployment startup healthcheck (artifact.toml → health.startup) hits
// this route; a 503 here causes the deployment to fail fast with a clear error
// rather than hanging until the process is killed.
//
// connect_timeout=5 is a PostgreSQL protocol-level TCP timeout (not a pool-queue
// wait). It ensures a bad DB host fails in ~5 s instead of hanging silently.

router.get("/healthz", async (_req, res): Promise<void> => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    res.status(503).json({
      status: "error",
      db: { connected: false, error: "DATABASE_URL not set" },
    });
    return;
  }

  const dbUrlWithTimeout = dbUrl.includes("?")
    ? `${dbUrl}&connect_timeout=5`
    : `${dbUrl}?connect_timeout=5`;

  const pool = new Pool({
    connectionString: dbUrlWithTimeout,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });

  const t0 = Date.now();
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    res.status(200).json({
      status: "ok",
      db: { connected: true, latencyMs: Date.now() - t0 },
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      db: {
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  } finally {
    await pool.end().catch(() => {});
  }
});

router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

// ── Rich health endpoint ───────────────────────────────────────────────────────

router.get("/health", async (_req, res): Promise<void> => {
  const uptimeMs = Date.now() - BOOT_TIME;

  // 1. Secrets
  const secrets = Object.fromEntries(
    REQUIRED_SECRETS.map(({ key, label }) => [
      key,
      { present: Boolean(process.env[key]), label },
    ])
  );
  const allSecretsPresent = REQUIRED_SECRETS.every(({ key }) => Boolean(process.env[key]));

  // 2. DB connectivity — quick ping with a short timeout
  let db: { connected: boolean; latencyMs: number | null; error: string | null };
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    db = { connected: false, latencyMs: null, error: "DATABASE_URL not set" };
  } else {
    const dbUrlWithTimeout = dbUrl.includes("?")
      ? `${dbUrl}&connect_timeout=5`
      : `${dbUrl}?connect_timeout=5`;
    const pool = new Pool({ connectionString: dbUrlWithTimeout, connectionTimeoutMillis: 5_000, max: 1 });
    const t0 = Date.now();
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      db = { connected: true, latencyMs: Date.now() - t0, error: null };
    } catch (err) {
      db = {
        connected: false,
        latencyMs: null,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      await pool.end().catch(() => {});
    }
  }

  // 3. Overall status
  const healthy = allSecretsPresent && db.connected;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    uptime: {
      ms: uptimeMs,
      human: formatUptime(uptimeMs),
    },
    secrets,
    db,
    timestamp: new Date().toISOString(),
  });
});

// ── Admin health-status probe ─────────────────────────────────────────────────
//
// Lightweight: reuses the shared pool (no new connection), and hits
// Groq's /models list (no tokens consumed). Returns within ~5 s under any
// failure because both checks run in parallel with a 5 s AbortController.

router.get("/health/status", requireAdmin, async (_req, res): Promise<void> => {
  const [dbResult, groqResult] = await Promise.allSettled([
    // DB — quick ping via the shared pool (already open)
    (async () => {
      const t0 = Date.now();
      await sharedPool.query("SELECT 1");
      return Date.now() - t0;
    })(),

    // Groq — list models endpoint (no completions, no tokens)
    (async () => {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error("GROQ_API_KEY not set");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      try {
        const r = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
          signal: controller.signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } finally {
        clearTimeout(timer);
      }
    })(),
  ]);

  res.json({
    db:   dbResult.status   === "fulfilled" ? "ok" : "error",
    groq: groqResult.status === "fulfilled" ? "ok" : "error",
    dbLatencyMs: dbResult.status === "fulfilled" ? dbResult.value : null,
    checkedAt: new Date().toISOString(),
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default router;
