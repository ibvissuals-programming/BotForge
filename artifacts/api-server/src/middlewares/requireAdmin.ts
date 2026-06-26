import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/adminToken";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-admin-token"];
  if (typeof token !== "string" || !verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized. Valid admin token required." });
    return;
  }
  next();
}
