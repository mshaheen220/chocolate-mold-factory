import type { ParamSchema, ScadParams, Workflow } from "../types";

export class ValidationError extends Error {
  public readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid parameters: ${issues.join("; ")}`);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/**
 * Parameter whitelists. Every value that reaches the OpenSCAD CLI as a `-D`
 * flag must originate from one of these specs — nothing from the request
 * body is ever forwarded verbatim. This is the primary command-injection
 * guard: numbers are range-checked and re-serialized, enums are checked
 * against a fixed option list, and booleans are coerced to literal
 * true/false.
 */
export const medallionSchema: ParamSchema = {
  render_mode: {
    type: "enum",
    options: [
      "single_token",
      "tokens_2x2",
      "reusable_mold_box",
      "adjustable_frame_strip",
      "adjustable_frame_batch",
      "adjustable_frame_preview",
    ],
    default: "single_token",
  },
  svg_scale: { type: "number", min: 0.01, max: 20, default: 1 },
  token_shape: { type: "enum", options: ["circle", "square", "oval", "rectangle"], default: "circle" },
  token_size: { type: "number", min: 5, max: 300, default: 40 },
  token_length: { type: "number", min: 5, max: 300, default: 60 },
  corner_radius: { type: "number", min: 0, max: 50, default: 4 },
  base_thickness: { type: "number", min: 0.4, max: 50, default: 3 },
  relief_height: { type: "number", min: 0.1, max: 20, default: 1.5 },
  draft_angle: { type: "number", min: 0, max: 45, default: 3 },
  border_style: { type: "enum", options: ["none", "single", "double", "beaded"], default: "none" },
  border_inset: { type: "number", min: 0, max: 40, default: 3 },
  border_width: { type: "number", min: 0.2, max: 15, default: 1.6 },
  border_gap: { type: "number", min: 0, max: 15, default: 1.2 },
  border_height: { type: "number", min: 0.1, max: 10, default: 0.8 },
  bead_count: { type: "number", min: 4, max: 60, default: 24, integer: true },
  bead_size: { type: "number", min: 0.5, max: 15, default: 2.5 },
  grid_x: { type: "number", min: 1, max: 10, default: 2, integer: true },
  grid_y: { type: "number", min: 1, max: 10, default: 2, integer: true },
  spacing: { type: "number", min: 0, max: 100, default: 5 },
  outer_margin: { type: "number", min: 0, max: 100, default: 8 },
  silicone_depth: { type: "number", min: 1, max: 100, default: 6 },
  box_wall_th: { type: "number", min: 1, max: 50, default: 4 },
  box_floor_th: { type: "number", min: 1, max: 50, default: 3 },
  frame_flange_width: { type: "number", min: 2, max: 60, default: 10 },
  frame_strip_length: { type: "number", min: 20, max: 500, default: 160 },
  frame_batch_count: { type: "number", min: 1, max: 20, default: 4, integer: true },
};

export const moldBoxSchema: ParamSchema = {
  mold_inner_length_x: { type: "number", min: 5, max: 500, default: 80 },
  mold_inner_width_y: { type: "number", min: 5, max: 500, default: 60 },
  mold_inner_depth_z: { type: "number", min: 2, max: 200, default: 20 },
  wall_thickness: { type: "number", min: 1, max: 50, default: 5 },
  floor_thickness: { type: "number", min: 1, max: 50, default: 4 },
  draft_angle: { type: "number", min: 0, max: 45, default: 3 },
  enable_center_guide: { type: "boolean", default: false },
  guide_length_x: { type: "number", min: 1, max: 400, default: 20 },
  guide_width_y: { type: "number", min: 1, max: 400, default: 15 },
};

export const schemasByWorkflow: Record<Workflow, ParamSchema> = {
  medallion: medallionSchema,
  mold_box: moldBoxSchema,
};

export const templateByWorkflow: Record<Workflow, string> = {
  medallion: "medallion.scad",
  mold_box: "mold_box.scad",
};

export type Quality = "draft" | "final";

// OpenSCAD's CGAL boolean-op cost scales heavily with facet count; a CLI
// `-D $fn=N` overrides whatever the template itself assigns (confirmed
// empirically), so this is the whole mechanism behind fast "Preview" vs
// slow, print-quality "Render" - mirroring OpenSCAD's own F5/F6 split.
export const FACET_COUNT_BY_QUALITY: Record<Quality, number> = { draft: 16, final: 96 };

// Beaded borders union one small circle per bead at a fixed local
// resolution (independent of $fn), so on a multi-token grid they dominate
// compile time regardless of the global facet count above. Capping the
// bead count in draft mode is what actually keeps a beaded preview fast.
export const DRAFT_BEAD_COUNT_CAP = 8;

export function parseQuality(raw: unknown): Quality {
  return raw === "draft" ? "draft" : "final";
}

export function isWorkflow(value: unknown): value is Workflow {
  return value === "medallion" || value === "mold_box";
}

/** Validates & coerces raw multipart/JSON body fields against a schema. */
export function validateParams(schema: ParamSchema, raw: Record<string, unknown>): ScadParams {
  const issues: string[] = [];
  const result: ScadParams = {};

  for (const [key, spec] of Object.entries(schema)) {
    const rawValue = raw[key];

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      result[key] = spec.default;
      continue;
    }

    if (spec.type === "number") {
      const asString = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      const num = typeof asString === "number" ? asString : Number(asString);
      if (!Number.isFinite(num)) {
        issues.push(`${key} must be a finite number`);
        continue;
      }
      if (num < spec.min || num > spec.max) {
        issues.push(`${key} must be between ${spec.min} and ${spec.max}`);
        continue;
      }
      result[key] = spec.integer ? Math.round(num) : num;
    } else if (spec.type === "enum") {
      const str = String(Array.isArray(rawValue) ? rawValue[0] : rawValue);
      if (!spec.options.includes(str)) {
        issues.push(`${key} must be one of: ${spec.options.join(", ")}`);
        continue;
      }
      result[key] = str;
    } else if (spec.type === "boolean") {
      const str = String(Array.isArray(rawValue) ? rawValue[0] : rawValue).toLowerCase();
      if (!["true", "false", "1", "0"].includes(str)) {
        issues.push(`${key} must be a boolean`);
        continue;
      }
      result[key] = str === "true" || str === "1";
    }
  }

  // Reject any keys in the raw payload that are not part of the schema and
  // not one of the known non-parameter fields, so unexpected fields never
  // silently pass through unvalidated.
  const knownNonParamKeys = new Set(["workflow", "quality"]);
  for (const key of Object.keys(raw)) {
    if (!(key in schema) && !knownNonParamKeys.has(key)) {
      issues.push(`Unexpected field: ${key}`);
    }
  }

  if (issues.length > 0) {
    throw new ValidationError(issues);
  }

  return result;
}

/** Escapes a string for safe embedding inside an OpenSCAD `-D var="value"` literal. */
export function escapeScadString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
