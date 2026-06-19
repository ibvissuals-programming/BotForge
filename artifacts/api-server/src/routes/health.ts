import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const healthResponse = () => HealthCheckResponse.parse({ status: "ok" });

router.get("/healthz", (_req, res) => {
  res.json(healthResponse());
});

router.get("/health", (_req, res) => {
  res.json(healthResponse());
});

router.get("/", (_req, res) => {
  res.json(healthResponse());
});

export default router;
