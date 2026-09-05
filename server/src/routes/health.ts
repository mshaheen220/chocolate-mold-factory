import { Router } from "express";
import { checkOpenScadAvailable } from "../lib/openscad";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const openscad = await checkOpenScadAvailable();
  const status = openscad.available ? 200 : 503;
  res.status(status).json({
    status: openscad.available ? "ok" : "degraded",
    openscad,
    timestamp: new Date().toISOString(),
  });
});
