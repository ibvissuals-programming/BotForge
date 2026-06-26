import { Pool } from "pg";

// ── Shared application database pool ─────────────────────────────────────────
//
// Single Pool instance shared by all route modules (businesses, leads).
// connect_timeout=15 is appended to DATABASE_URL at the PostgreSQL protocol
// level so a silently-unreachable host fails fast (~15 s) rather than hanging
// indefinitely.  This is intentional per C2.
//
// Health-check routes (/healthz, /health) intentionally use their own
// short-lived per-request pools with connect_timeout=5 so they fail quickly
// without affecting the application pool.
//
// The migration pool (db-migrate.ts) is also separate — it is single-use,
// opened at boot and closed immediately after migrations complete.

export function dbUrlWithTimeout(url: string | undefined, secs = 15): string | undefined {
  if (!url) return url;
  return url.includes("?") ? `${url}&connect_timeout=${secs}` : `${url}?connect_timeout=${secs}`;
}

export const pool = new Pool({
  connectionString: dbUrlWithTimeout(process.env.DATABASE_URL),
});
