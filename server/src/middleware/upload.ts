import crypto from "node:crypto";
import path from "node:path";
import multer, { type FileFilterCallback } from "multer";
import type { Request } from "express";
import { config } from "../config";

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  ".svg": ["image/svg+xml", "text/plain", "application/octet-stream"],
  ".stl": ["model/stl", "application/sla", "application/octet-stream", "text/plain"],
};

function safeExtension(originalName: string): string | null {
  const ext = path.extname(originalName).toLowerCase();
  return ext in ALLOWED_EXTENSIONS ? ext : null;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.paths.uploads),
  filename: (_req, file, cb) => {
    const ext = safeExtension(file.originalname);
    // fileFilter rejects unknown extensions before this runs, but fall back
    // defensively rather than trust the original name in any way.
    const safeExt = ext ?? ".bin";
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ext = safeExtension(file.originalname);
  if (!ext) {
    cb(new Error("Only .svg and .stl files are accepted"));
    return;
  }
  const allowedMimes = ALLOWED_EXTENSIONS[ext];
  if (!allowedMimes.includes(file.mimetype)) {
    cb(new Error(`Unexpected content type "${file.mimetype}" for ${ext} file`));
    return;
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
  },
});
