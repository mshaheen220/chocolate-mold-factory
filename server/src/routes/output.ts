import path from "node:path";
import fs from "node:fs";
import { Router } from "express";
import { config } from "../config";

export const outputRouter = Router();

// Output files are always server-generated UUID names — this pattern also
// acts as a path-traversal guard since it cannot contain "/" or "..".
const SAFE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.stl$/i;

outputRouter.get("/output/:fileName", (req, res) => {
  const { fileName } = req.params;
  if (!SAFE_FILENAME.test(fileName)) {
    res.status(400).json({ error: "Invalid file name" });
    return;
  }

  const filePath = path.join(config.paths.output, fileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found or has expired" });
    return;
  }

  res.setHeader("Content-Type", "model/stl");
  if (req.query.download === "1") {
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  }
  res.sendFile(filePath);
});
