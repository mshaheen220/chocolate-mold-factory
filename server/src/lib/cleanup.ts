import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config";

async function sweepDir(dir: string, maxAgeMs: number): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }

  const now = Date.now();
  await Promise.all(
    entries
      .filter((name) => name !== ".gitkeep")
      .map(async (name) => {
        const filePath = path.join(dir, name);
        try {
          const stat = await fs.stat(filePath);
          if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
            await fs.unlink(filePath);
          }
        } catch {
          // File may have been removed concurrently; ignore.
        }
      }),
  );
}

export async function sweepTempArtifacts(): Promise<void> {
  await Promise.all([
    sweepDir(config.paths.uploads, config.fileTtlMs),
    sweepDir(config.paths.output, config.fileTtlMs),
    sweepDir(config.paths.temp, config.fileTtlMs),
  ]);
}

export function startCleanupScheduler(intervalMs = 15 * 60 * 1000): NodeJS.Timeout {
  return setInterval(() => {
    sweepTempArtifacts().catch((err) => console.error("[cleanup] sweep failed", err));
  }, intervalMs);
}

/** Best-effort immediate removal of a single file (e.g. a consumed upload). */
export async function removeFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Already gone — fine.
  }
}
