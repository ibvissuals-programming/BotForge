import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { generateToken } from "../lib/adminToken";

const router: IRouter = Router();

if (!process.env.BOTFORGE_CEO_PASSWORD) {
  logger.warn("BOTFORGE_CEO_PASSWORD is not set — /auth/admin-login will always reject");
}

/** POST /auth/admin-login — validate admin password, return a signed token */
router.post("/auth/admin-login", (req, res): void => {
  const { password } = req.body as { password?: string };

  if (!password || typeof password !== "string") {
    res.status(400).json({ error: "Password is required." });
    return;
  }

  const expected = process.env.BOTFORGE_CEO_PASSWORD;

  if (!expected) {
    res.status(503).json({ error: "Admin login is not configured on the server." });
    return;
  }

  if (password !== expected) {
    res.status(401).json({ error: "Incorrect password." });
    return;
  }

  const token = generateToken();
  logger.info("Admin login successful — token issued");
  res.json({ ok: true, token });
});

export default router;
