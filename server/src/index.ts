import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import dotenv from "dotenv";
import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import { config } from "./config";
import { startCleanupScheduler, sweepTempArtifacts } from "./lib/cleanup";
import { generateRouter } from "./routes/generate";
import { healthRouter } from "./routes/health";
import { outputRouter } from "./routes/output";

dotenv.config();

for (const dir of [config.paths.uploads, config.paths.output, config.paths.temp]) {
  fs.mkdirSync(dir, { recursive: true });
}

const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", healthRouter);
app.use("/api", generateRouter);
app.use("/api", outputRouter);

// Serve the built frontend in production (single-container deployment).
if (fs.existsSync(config.paths.clientDist)) {
  app.use(express.static(config.paths.clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(path.join(config.paths.clientDist, "index.html"));
  });
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: `Upload error: ${err.message}` });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

sweepTempArtifacts().catch((err) => console.error("[cleanup] initial sweep failed", err));
startCleanupScheduler();

app.listen(config.port, () => {
  console.log(`Chocolate Mold Factory server listening on port ${config.port}`);
});
