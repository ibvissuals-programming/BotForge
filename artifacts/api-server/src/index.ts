import app from "./app";
import { logger } from "./lib/logger";
import { runSecretsCheck } from "./lib/secrets-check";

// ── Secrets checklist — runs first on every startup ───────────────────────────
runSecretsCheck();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Graceful shutdown — called when Replit autoscale sends SIGTERM during
// rolling deploys. Stops accepting new connections, lets in-flight requests
// finish (up to 10 s), then exits cleanly so no requests are dropped.
function shutdown(signal: string): void {
  logger.info({ signal }, "Shutdown signal received — draining connections");

  server.close(() => {
    logger.info("All connections drained — exiting cleanly");
    process.exit(0);
  });

  setTimeout(() => {
    logger.warn("Drain timeout exceeded — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
