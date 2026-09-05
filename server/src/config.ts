import path from "node:path";

const root = path.resolve(__dirname, "..");

export const config = {
  port: Number(process.env.PORT ?? 3000),
  openscadBin: process.env.OPENSCAD_BIN ?? "openscad",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024),
  fileTtlMs: Number(process.env.FILE_TTL_MS ?? 60 * 60 * 1000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  openscadTimeoutMs: Number(process.env.OPENSCAD_TIMEOUT_MS ?? 60_000),
  paths: {
    uploads: path.join(root, "uploads"),
    output: path.join(root, "output"),
    temp: path.join(root, "temp"),
    templates: path.join(root, "templates"),
    clientDist: path.join(root, "..", "client", "dist"),
  },
} as const;
