import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import ogScraperRouter from "./routes/og-scraper";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve OG preview images at /og/<filename>.
// build.mjs copies artifacts/chatbot/public/og/ → dist/og/ at build time,
// so these images are co-located with the bundle in both dev and production.
// The og-scraper and /api/preview routes both emit og:image URLs pointing to
// the API server host — those URLs must resolve here, not on the chatbot host.
app.use("/og", express.static(path.join(__dirname, "og"), {
  maxAge: "7d",
  immutable: false,
}));

// OG meta tag injection for link-preview scrapers (WhatsApp, Twitter, etc.).
// Must be registered after /api so it only matches non-API paths.
// Only responds when the User-Agent is a known scraper — real browsers call
// next() and receive a 404 (they use the chatbot Vite server or static dist).
app.use(ogScraperRouter);

export default app;
