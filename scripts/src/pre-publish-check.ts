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

/**
 * Log in with BOTFORGE_CEO_PASSWORD and return the signed admin token
 * from the JSON response body.  The token must be sent as the
 * X-Admin-Token header on every protected request (C1 auth architecture).
 */
async function login(): Promise<string> {
  const res = await fetch(`${API}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed — HTTP ${res.status}`);
  const body = (await res.json()) as { ok: boolean; token: string };
  if (!body.ok || !body.token) throw new Error(`Login response missing token: ${JSON.stringify(body)}`);
  return body.token;
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
    const token = await login();
    const res = await fetch(`${API}/api/businesses`, {
      headers: { "X-Admin-Token": token },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body)) throw new Error(`Expected array, got ${typeof body}`);
    return `${body.length} business${body.length === 1 ? "" : "es"} found`;
  }));

  // ── 5. Leads endpoint (authenticated) ─────────────────────────────────────
  results.push(await check("GET /api/leads — returns valid array", async () => {
    const token = await login();
    const res = await fetch(`${API}/api/leads`, {
      headers: { "X-Admin-Token": token },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body)) throw new Error(`Expected array, got ${typeof body}`);
    return `${body.length} lead${body.length === 1 ? "" : "s"} found`;
  }));

  // ── 6. Protected routes reject unauthenticated requests ───────────────────
  results.push(await check("GET /api/leads (no token) — returns 401", async () => {
    const res = await fetch(`${API}/api/leads`);
    if (res.status !== 401) throw new Error(`Expected 401, got HTTP ${res.status}`);
    return "HTTP 401 as expected";
  }));

  // ── 7. Customer-facing chatbot ────────────────────────────────────────────
  results.push(await check("GET localhost:3000 — chatbot serves + Fortune config in API", async () => {
    // 7a: chatbot app shell
    const chatbotRes = await fetch("http://localhost:3000/");
    if (!chatbotRes.ok) throw new Error(`Chatbot HTTP ${chatbotRes.status} (is the chatbot workflow running?)`);
    const html = await chatbotRes.text();
    if (!html.includes("BotForge")) throw new Error('HTML missing "BotForge" — wrong app or build broken');
    if (!html.includes('id="root"')) throw new Error('HTML missing id="root" — SPA mount point absent');

    // 7b: Fortune's business config present in API (this is what the chatbot loads at runtime)
    const token = await login();
    const bizRes = await fetch(`${API}/api/businesses`, {
      headers: { "X-Admin-Token": token },
    });
    if (!bizRes.ok) throw new Error(`Businesses API HTTP ${bizRes.status}`);
    const businesses = (await bizRes.json()) as Array<{ bizName: string }>;
    const fortune = businesses.find((b) => b.bizName.toLowerCase().includes("fortune"));
    if (!fortune) throw new Error('"Styled By Fortune" not found in businesses — chatbot config missing');

    return `HTTP 200, app shell ready · "${fortune.bizName}" config confirmed`;
  }));

  // ── 8. OG preview images reachable from the API server's own host ──────────
  //
  // The og-scraper and /api/preview/:slug routes emit og:image URLs pointing to
  // the API server's host (e.g. https://<domain>/og/rossy.jpg).  WhatsApp and
  // other link-preview bots follow that URL directly — if the API server cannot
  // serve it, the preview shows a broken image.  This check catches exactly that
  // class of bug: a missing express.static route, a failed build copy step, or
  // a newly-added business whose image file was never committed.
  results.push(await check("GET /og/<filename> — OG images reachable on API server host", async () => {
    const token = await login();
    const bizRes = await fetch(`${API}/api/businesses`, {
      headers: { "X-Admin-Token": token },
    });
    if (!bizRes.ok) throw new Error(`Businesses API HTTP ${bizRes.status}`);
    const businesses = (await bizRes.json()) as Array<{ bizName: string; ogImageFilename?: string | null }>;

    const withImage = businesses.filter((b) => b.ogImageFilename);
    if (withImage.length === 0) {
      return "no businesses have ogImageFilename set — skipped";
    }

    const failures: string[] = [];
    const successes: string[] = [];

    for (const biz of withImage) {
      const url = `${API}/og/${biz.ogImageFilename}`;
      const res = await fetch(url);
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        failures.push(`${biz.ogImageFilename} → HTTP ${res.status}`);
      } else if (!ct.startsWith("image/")) {
        failures.push(`${biz.ogImageFilename} → wrong content-type "${ct}"`);
      } else {
        successes.push(`${biz.ogImageFilename}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`${failures.length} image(s) unreachable: ${failures.join(", ")}`);
    }

    return `${successes.length} image${successes.length === 1 ? "" : "s"} OK (${successes.join(", ")})`;
  }));

  // ── 9. OG tags present when fetched with scraper UA ──────────────────────
  //
  // Spawns og-server.mjs on a temp port against the production build output
  // (dist/public/) and fetches each business slug with a WhatsApp User-Agent.
  // Verifies: HTTP 200 + og:image present + og:image contains the correct
  // ogImageFilename.  Kills the temp server when done.
  //
  // This test runs against og-server.mjs directly (not the Vite dev server)
  // because og-server.mjs is the production binary.  It is the exact check
  // that would have caught the cross-container localhost:8080 failure that
  // caused the WhatsApp preview bug.
  results.push(await check("GET /:slug (WhatsApp UA via og-server) — og:image present and correct", async () => {
    const { spawn } = await import("child_process");
    const path = await import("path");

    // Resolve paths relative to workspace root (script runs from scripts/)
    const workspaceRoot = path.resolve(process.cwd(), "..");
    const ogServerPath = path.join(workspaceRoot, "artifacts/chatbot/og-server.mjs");
    const distPath = path.join(workspaceRoot, "artifacts/chatbot/dist/public");

    // Verify the build output exists before attempting to spawn
    const fs = await import("fs");
    if (!fs.existsSync(distPath)) {
      throw new Error(
        "artifacts/chatbot/dist/public not found — run `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/chatbot run build` first"
      );
    }

    const OG_PORT = 3099;

    // Spawn og-server.mjs on the temp port
    const proc = spawn("node", [ogServerPath], {
      env: { ...process.env, PORT: String(OG_PORT) },
      stdio: "pipe",
    });

    // Wait for the server to be ready (up to 5 s)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("og-server.mjs did not start within 5 s")), 5_000);
      proc.stdout?.on("data", (chunk: Buffer) => {
        if (chunk.toString().includes("listening")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      proc.on("error", (err) => { clearTimeout(timeout); reject(err); });
      proc.on("exit", (code) => { clearTimeout(timeout); reject(new Error(`og-server.mjs exited early with code ${code}`)); });
    });

    const killServer = () => { try { proc.kill(); } catch { /* ignore */ } };

    try {
      const token = await login();
      const bizRes = await fetch(`${API}/api/businesses`, {
        headers: { "X-Admin-Token": token },
      });
      if (!bizRes.ok) throw new Error(`Businesses API HTTP ${bizRes.status}`);
      const businesses = (await bizRes.json()) as Array<{
        bizName: string;
        slug?: string | null;
        ogImageFilename?: string | null;
      }>;

      const withSlugAndImage = businesses.filter((b) => b.slug && b.ogImageFilename);
      if (withSlugAndImage.length === 0) {
        return "no businesses have both slug and ogImageFilename set — skipped";
      }

      const failures: string[] = [];
      const successes: string[] = [];

      for (const biz of withSlugAndImage) {
        const url = `http://localhost:${OG_PORT}/${biz.slug}`;
        const res = await fetch(url, {
          headers: { "User-Agent": "WhatsApp/2.23.10.0 A" },
        });
        if (!res.ok) {
          failures.push(`/${biz.slug} → HTTP ${res.status}`);
          continue;
        }
        const html = await res.text();
        const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
        if (!ogImageMatch) {
          failures.push(`/${biz.slug} → no og:image tag in response`);
          continue;
        }
        if (!ogImageMatch[1].includes(biz.ogImageFilename!)) {
          failures.push(
            `/${biz.slug} → og:image is "${ogImageMatch[1]}", expected to contain "${biz.ogImageFilename}"`
          );
          continue;
        }
        successes.push(`/${biz.slug} → ${ogImageMatch[1]}`);
      }

      if (failures.length > 0) {
        throw new Error(`${failures.length} slug(s) failed OG check:\n       ${failures.join("\n       ")}`);
      }

      return successes.join("\n       ");
    } finally {
      killServer();
    }
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
