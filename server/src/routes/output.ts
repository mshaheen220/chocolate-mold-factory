import path from "node:path";
import fs from "node:fs";
import { Router } from "express";
import { config } from "../config";

export const outputRouter = Router();

// Output files are always server-generated UUID names — this pattern also
// acts as a path-traversal guard since it cannot contain "/" or "..".
const SAFE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.stl$/i;

// Lets the client suggest a human-friendly download name (via ?name=) while
// the file on disk stays the server-generated UUID. Strips anything that
// isn't safe in a Content-Disposition header value or a filesystem name
// (also blocks header/CRLF injection), then re-appends .stl if stripping
// ate the extension.
function sanitizeDownloadName(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw
    .replace(/[^a-zA-Z0-9 _.-]/g, "")
    .trim()
    .slice(0, 150);
  if (!cleaned) return fallback;
  return cleaned.toLowerCase().endsWith(".stl") ? cleaned : `${cleaned}.stl`;
}

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
    const downloadName = sanitizeDownloadName(req.query.name, fileName);
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  }
  res.sendFile(filePath);
});
