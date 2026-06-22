import { Router, type IRouter } from "express";
import { Pool } from "pg";

const router: IRouter = Router();

const BOOT_TIME = Date.now();

const REQUIRED_SECRETS = [
  { key: "GROQ_API_KEY",           label: "Groq AI (chat + promo)" },
  { key: "BOTFORGE_CEO_PASSWORD",  label: "Admin dashboard password" },
  { key: "DATABASE_URL",           label: "PostgreSQL database" },
];

// ── Simple liveness probe — used by Replit deployment healthcheck ─────────────

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
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
    const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 5_000, max: 1 });
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
