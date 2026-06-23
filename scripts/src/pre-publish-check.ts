#!/usr/bin/env tsx
/**
 * pre-publish-check.ts
 *
 * Smoke-tests the running API server before a publish.
 * Run via:  pnpm run pre-publish
 *
 * Requires the api-server workflow to be running (port 8080).
 * Requires BOTFORGE_CEO_PASSWORD to be set in the environment.
 *
 * Exit code 0 = all checks passed, safe to publish.
 * Exit code 1 = one or more checks failed, do not publish.
 */

const API = "http://localhost:8080";
const PASSWORD = process.env.BOTFORGE_CEO_PASSWORD ?? "";

type CheckResult = { name: string; passed: boolean; detail: string };

async function check(name: string, fn: () => Promise<string>): Promise<CheckResult> {
  try {
    const detail = await fn();
    return { name, passed: true, detail };
  } catch (err: unknown) {
    return { name, passed: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function run() {
  console.log("\n  BotForge — Pre-Publish Smoke Test");
  console.log("  ──────────────────────────────────\n");

  const results: CheckResult[] = [];

  // ── 1. Healthz ────────────────────────────────────────────────────────────
  results.push(await check("GET /api/healthz — server responds", async () => {
    const res = await fetch(`${API}/api/healthz`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return `HTTP ${res.status}`;
  }));

  // ── 2. DB connected ───────────────────────────────────────────────────────
  results.push(await check("GET /api/healthz — DB connected", async () => {
    const res = await fetch(`${API}/api/healthz`);
    const body = (await res.json()) as { status: string; db?: { connected: boolean; latencyMs: number } };
    if (!body.db?.connected) throw new Error(`db.connected is false — body: ${JSON.stringify(body)}`);
    return `connected, latency ${body.db.latencyMs}ms`;
  }));

  // ── 3. Auth endpoint reachable ────────────────────────────────────────────
  results.push(await check("POST /api/auth/admin-login — endpoint reachable", async () => {
    if (!PASSWORD) throw new Error("BOTFORGE_CEO_PASSWORD not set in environment");
    const res = await fetch(`${API}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} — wrong password or route missing`);
    const body = (await res.json()) as { ok: boolean };
    if (!body.ok) throw new Error(`Response ok=false: ${JSON.stringify(body)}`);
    return "authenticated";
  }));

  // ── 4. Businesses endpoint (authenticated) ────────────────────────────────
  results.push(await check("GET /api/businesses — returns valid array", async () => {
    // Login to get session cookie
    const loginRes = await fetch(`${API}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await fetch(`${API}/api/businesses`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body)) throw new Error(`Expected array, got ${typeof body}`);
    return `${body.length} business${body.length === 1 ? "" : "es"} found`;
  }));

  // ── 5. Leads endpoint (authenticated) ─────────────────────────────────────
  results.push(await check("GET /api/leads — returns valid array", async () => {
    const loginRes = await fetch(`${API}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const cookie = loginRes.headers.get("set-cookie") ?? "";

    const res = await fetch(`${API}/api/leads`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body)) throw new Error(`Expected array, got ${typeof body}`);
    return `${body.length} lead${body.length === 1 ? "" : "s"} found`;
  }));

  // ── Print results ──────────────────────────────────────────────────────────
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    const status = r.passed ? r.detail : `FAIL — ${r.detail}`;
    console.log(`  ${icon}  ${r.name}`);
    if (!r.passed) {
      console.log(`       ${status}`);
      allPassed = false;
    } else {
      console.log(`       ${status}`);
    }
  }

  console.log("\n  ──────────────────────────────────");
  if (allPassed) {
    console.log("  All checks passed — safe to publish ✅\n");
    process.exit(0);
  } else {
    console.log("  One or more checks failed — do NOT publish ❌\n");
    process.exit(1);
  }
}

run();
