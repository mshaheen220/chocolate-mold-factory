import type { ParamValues } from "../types";
import type { ColorSettings } from "./contour";
import { downloadTextFile } from "./downloadFile";

// Bump this if the shape below changes in a way that isn't
// backwards-compatible, so a future import step can detect and reject (or
// migrate) files saved by an older version. v2 dropped the mold_box
// workflow (and the "workflow"/"moldBoxParams" fields that went with it) -
// older files still import fine since those fields are simply ignored now.
export const APP_SETTINGS_VERSION = 2;

export interface AppSettingsFile {
  version: number;
  exportedAt: string;
  renderDetail: number;
  medallionParams: ParamValues;
  /** Contoured pieces' per-color settings, keyed by fill color (e.g. "#113595"). Absent in older files. */
  contourColors?: ColorSettings;
}

export function buildAppSettingsPayload(settings: Omit<AppSettingsFile, "version" | "exportedAt">): AppSettingsFile {
  return {
    version: APP_SETTINGS_VERSION,
    exportedAt: new Date().toISOString(),
    ...settings,
  };
}

export function exportAppSettings(
  settings: Omit<AppSettingsFile, "version" | "exportedAt">,
  fileName?: string,
): void {
  const payload = buildAppSettingsPayload(settings);
  const trimmedName = fileName?.trim();
  const jsonFileName = trimmedName
    ? trimmedName.toLowerCase().endsWith(".json")
      ? trimmedName
      : `${trimmedName}.json`
    : "chocolate-mold-factory-settings.json";
  downloadTextFile(jsonFileName, JSON.stringify(payload, null, 2), "application/json");
}

function isParamValues(value: unknown): value is ParamValues {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "number" || typeof v === "string" || typeof v === "boolean");
}

/** Parses and shape-checks a settings file's contents; throws a descriptive Error on anything malformed. */
export function parseAppSettingsFile(raw: unknown): AppSettingsFile {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Not a valid settings file");
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.renderDetail !== "number" || !Number.isFinite(obj.renderDetail)) {
    throw new Error("Missing or invalid renderDetail");
  }
  if (!isParamValues(obj.medallionParams)) {
    throw new Error("Missing or invalid medallionParams");
  }

  return {
    contourColors: parseColorSettings(obj.contourColors),
    version: typeof obj.version === "number" ? obj.version : 0,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
    renderDetail: obj.renderDetail,
    medallionParams: obj.medallionParams,
  };
}

function parseColorSettings(raw: unknown): ColorSettings | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const result: ColorSettings = {};
  for (const [key, value] of Object.entries(raw)) {
    const v = value as { included?: unknown; height?: unknown } | null;
    if (v && typeof v.included === "boolean" && typeof v.height === "number" && Number.isFinite(v.height)) {
      result[key] = { included: v.included, height: v.height };
    }
  }
  return result;
}

/** Reads and parses a settings file picked via a file input. */
export async function readAppSettingsFile(file: File): Promise<AppSettingsFile> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`"${file.name}" isn't valid JSON`);
  }
  return parseAppSettingsFile(raw);
}
