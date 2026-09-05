import path from "node:path";

const root = path.resolve(__dirname, "..");

export const config = {
  port: Number(process.env.PORT ?? 3000),
  openscadBin: process.env.OPENSCAD_BIN ?? "openscad",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024),
  fileTtlMs: Number(process.env.FILE_TTL_MS ?? 60 * 60 * 1000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  // Full-quality renders with a beaded border and/or a detailed uploaded
  // graphic have measured at 20-25s on modest hardware even for a single
  // token; a slower host or a more complex file can comfortably exceed a
  // 60s cap. 3 minutes gives real headroom without hanging forever on a
  // genuinely broken template.
  openscadTimeoutMs: Number(process.env.OPENSCAD_TIMEOUT_MS ?? 180_000),
  paths: {
    uploads: path.join(root, "uploads"),
    output: path.join(root, "output"),
    temp: path.join(root, "temp"),
    templates: path.join(root, "templates"),
    clientDist: path.join(root, "..", "client", "dist"),
  },
} as const;
