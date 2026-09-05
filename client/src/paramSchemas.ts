import type { Field, ParamValues } from "./types";
import { computeAutoFitScale, type SvgNaturalSize } from "./utils/svg";

// render_mode values that actually place tokens (base + relief + border).
const TOKEN_MODES = ["single_token", "tokens_2x2", "reusable_mold_box", "adjustable_frame_preview"];
// render_mode values that lay tokens out in a grid_x * grid_y array.
const GRID_MODES = ["tokens_2x2", "reusable_mold_box", "adjustable_frame_preview"];
// render_mode values with a margin between the token grid and the surrounding wall.
const MARGIN_MODES = ["reusable_mold_box", "adjustable_frame_preview"];
// render_mode values that build a wall out of box_wall_th / box_floor_th / silicone_depth.
const WALL_MODES = ["reusable_mold_box", "adjustable_frame_strip", "adjustable_frame_batch", "adjustable_frame_preview"];
// render_mode values that deal with individually-printed L-profile strips.
const FRAME_MODES = ["adjustable_frame_strip", "adjustable_frame_batch", "adjustable_frame_preview"];

export interface TokenPreset {
  id: "small" | "medium" | "large" | "custom";
  label: string;
  sublabel: string;
  size: number; // Diameter for circles, side/width length for other shapes (mm)
  baseThickness: number; // mm
  reliefHeight: number; // mm
}

export const TOKEN_PRESETS: Record<TokenPreset["id"], TokenPreset> = {
  small: {
    id: "small",
    label: "Small",
    sublabel: "30mm (~1.2\") · Foil Coin Size",
    size: 30,
    baseThickness: 3.5,
    reliefHeight: 1.5,
  },
  medium: {
    id: "medium",
    label: "Medium",
    sublabel: "45mm (~1.75\") · Oreo Size",
    size: 45,
    baseThickness: 4.5,
    reliefHeight: 1.8,
  },
  large: {
    id: "large",
    label: "Large",
    sublabel: "65mm (~2.5\") · Challenge Medallion",
    size: 65,
    baseThickness: 6.0,
    reliefHeight: 2.2,
  },
  custom: {
    id: "custom",
    label: "Custom",
    sublabel: "Manual millimeter control",
    // Deliberately distinct from every fixed preset above (matches this
    // app's own schema defaults) - if these coincided with e.g. Medium's
    // values, selecting Custom would set those numbers and then get
    // misidentified as Medium by getActiveTokenPreset below.
    size: 40,
    baseThickness: 3,
    reliefHeight: 1.5,
  },
};

/** Shared by both the upload flow and the size-preset flow, so a graphic
 * stays fit to the token whichever one last changed the token's footprint. */
export function autoFitScaleForToken(natural: SvgNaturalSize, params: ParamValues): number {
  const shape = params.token_shape;
  const targetWidth = Number(params.token_size);
  const targetHeight = shape === "oval" || shape === "rectangle" ? Number(params.token_length) : targetWidth;
  return computeAutoFitScale(natural, targetWidth, targetHeight);
}

/**
 * Derives the active preset from the current params, rather than tracking
 * it as separate state - so manually nudging a slider after picking a
 * preset naturally falls back to "custom" with no extra bookkeeping.
 *
 * Selecting a preset also re-fits `svg_scale` to the new token footprint
 * (see App.tsx's handlePresetSelect), so a manual change to SVG Scale
 * afterward should equally break the match even though svg_scale isn't
 * one of the preset's own fields. `svgNaturalSize` lets us recompute what
 * auto-fit would currently produce and compare against it; pass `null`
 * when no graphic is loaded to skip that check entirely.
 */
export function getActiveTokenPreset(params: ParamValues, svgNaturalSize: SvgNaturalSize | null): TokenPreset["id"] {
  const sizeMatch = Object.values(TOKEN_PRESETS).find(
    (preset) =>
      preset.id !== "custom" &&
      preset.size === Number(params.token_size) &&
      preset.baseThickness === Number(params.base_thickness) &&
      preset.reliefHeight === Number(params.relief_height),
  );
  if (!sizeMatch) return "custom";

  if (svgNaturalSize) {
    const expectedScale = autoFitScaleForToken(svgNaturalSize, params);
    if (Number(params.svg_scale) !== expectedScale) return "custom";
  }

  return sizeMatch.id;
}

export const isTokenMode = (p: ParamValues) => TOKEN_MODES.includes(String(p.render_mode));
const isGridMode = (p: ParamValues) => GRID_MODES.includes(String(p.render_mode));
const isMarginMode = (p: ParamValues) => MARGIN_MODES.includes(String(p.render_mode));
const isWallMode = (p: ParamValues) => WALL_MODES.includes(String(p.render_mode));
const isFrameMode = (p: ParamValues) => FRAME_MODES.includes(String(p.render_mode));
const hasBorder = (p: ParamValues) => isTokenMode(p) && p.border_style !== "none";

export const medallionFields: Field[] = [
  {
    type: "enum",
    key: "render_mode",
    label: "Render Mode",
    group: "geometry",
    default: "single_token",
    options: [
      { value: "single_token", label: "Single Token" },
      { value: "tokens_2x2", label: "Token Grid" },
      { value: "reusable_mold_box", label: "Reusable Mold Box" },
      { value: "adjustable_frame_strip", label: "Adjustable Frame — Single Strip" },
      { value: "adjustable_frame_batch", label: "Adjustable Frame — Print Batch" },
      { value: "adjustable_frame_preview", label: "Adjustable Frame — Assembly Preview" },
    ],
  },
  {
    type: "number",
    key: "svg_scale",
    label: "SVG Scale",
    group: "geometry",
    min: 0.1,
    max: 5,
    step: 0.05,
    default: 1,
    showIf: isTokenMode,
  },
  {
    type: "enum",
    key: "token_shape",
    label: "Token Shape",
    group: "geometry",
    default: "circle",
    options: [
      { value: "circle", label: "Circle" },
      { value: "square", label: "Square" },
      { value: "oval", label: "Oval" },
      { value: "rectangle", label: "Rectangle" },
    ],
    showIf: isTokenMode,
  },
  {
    type: "number",
    key: "token_size",
    label: "Token Size (width)",
    group: "geometry",
    min: 10,
    max: 150,
    step: 1,
    default: 40,
    unit: "mm",
    showIf: isTokenMode,
  },
  {
    type: "number",
    key: "token_length",
    label: "Token Length (Y)",
    group: "geometry",
    min: 10,
    max: 150,
    step: 1,
    default: 60,
    unit: "mm",
    showIf: (p) => isTokenMode(p) && (p.token_shape === "oval" || p.token_shape === "rectangle"),
  },
  {
    type: "number",
    key: "corner_radius",
    label: "Corner Radius",
    group: "geometry",
    min: 0,
    max: 30,
    step: 0.5,
    default: 4,
    unit: "mm",
    showIf: (p) => isTokenMode(p) && (p.token_shape === "square" || p.token_shape === "rectangle"),
  },
  {
    type: "number",
    key: "base_thickness",
    label: "Base Thickness",
    group: "geometry",
    min: 0.5,
    max: 20,
    step: 0.1,
    default: 3,
    unit: "mm",
    showIf: isTokenMode,
  },
  {
    type: "number",
    key: "relief_height",
    label: "Relief Height",
    group: "geometry",
    min: 0.2,
    max: 10,
    step: 0.1,
    default: 1.5,
    unit: "mm",
    showIf: isTokenMode,
  },
  {
    type: "number",
    key: "draft_angle",
    label: "Draft Angle",
    group: "geometry",
    min: 0,
    max: 30,
    step: 0.5,
    default: 3,
    unit: "°",
    showIf: isTokenMode,
  },

  // ---- Raised Border ----
  {
    type: "enum",
    key: "border_style",
    label: "Border Style",
    group: "border",
    default: "none",
    options: [
      { value: "none", label: "None" },
      { value: "single", label: "Single Ring" },
      { value: "double", label: "Double Ring" },
      { value: "beaded", label: "Beaded" },
    ],
    showIf: isTokenMode,
  },
  {
    type: "number",
    key: "border_inset",
    label: "Border Inset",
    group: "border",
    min: 0,
    max: 40,
    step: 0.5,
    default: 3,
    unit: "mm",
    showIf: hasBorder,
  },
  {
    type: "number",
    key: "border_width",
    label: "Border Line Width",
    group: "border",
    min: 0.2,
    max: 15,
    step: 0.1,
    default: 1.6,
    unit: "mm",
    showIf: (p) => hasBorder(p) && p.border_style !== "beaded",
  },
  {
    type: "number",
    key: "border_gap",
    label: "Border Line Gap",
    group: "border",
    min: 0,
    max: 15,
    step: 0.1,
    default: 1.2,
    unit: "mm",
    showIf: (p) => hasBorder(p) && p.border_style === "double",
  },
  {
    type: "number",
    key: "border_height",
    label: "Border Height",
    group: "border",
    min: 0.1,
    max: 10,
    step: 0.1,
    default: 0.8,
    unit: "mm",
    showIf: hasBorder,
  },
  {
    type: "number",
    key: "bead_count",
    label: "Bead Count",
    group: "border",
    min: 4,
    max: 60,
    step: 1,
    default: 24,
    showIf: (p) => hasBorder(p) && p.border_style === "beaded",
  },
  {
    type: "number",
    key: "bead_size",
    label: "Bead Size",
    group: "border",
    min: 0.5,
    max: 15,
    step: 0.1,
    default: 2.5,
    unit: "mm",
    showIf: (p) => hasBorder(p) && p.border_style === "beaded",
  },

  // ---- Mold Box Dimensions ----
  {
    type: "number",
    key: "grid_x",
    label: "Grid Columns",
    group: "cavity",
    min: 1,
    max: 10,
    step: 1,
    default: 2,
    showIf: isGridMode,
  },
  {
    type: "number",
    key: "grid_y",
    label: "Grid Rows",
    group: "cavity",
    min: 1,
    max: 10,
    step: 1,
    default: 2,
    showIf: isGridMode,
  },
  {
    type: "number",
    key: "spacing",
    label: "Token Spacing",
    group: "cavity",
    min: 0,
    max: 50,
    step: 0.5,
    default: 5,
    unit: "mm",
    showIf: isGridMode,
  },
  {
    type: "number",
    key: "outer_margin",
    label: "Outer Margin",
    group: "cavity",
    min: 0,
    max: 50,
    step: 0.5,
    default: 8,
    unit: "mm",
    showIf: isMarginMode,
  },
  {
    type: "number",
    key: "silicone_depth",
    label: "Silicone Depth",
    group: "cavity",
    min: 1,
    max: 40,
    step: 0.5,
    default: 6,
    unit: "mm",
    showIf: isWallMode,
  },
  {
    type: "number",
    key: "box_wall_th",
    label: "Wall Thickness",
    group: "cavity",
    min: 1,
    max: 20,
    step: 0.5,
    default: 4,
    unit: "mm",
    showIf: isWallMode,
  },
  {
    type: "number",
    key: "box_floor_th",
    label: "Floor / Foot Thickness",
    group: "cavity",
    min: 1,
    max: 20,
    step: 0.5,
    default: 3,
    unit: "mm",
    showIf: isWallMode,
  },

  // ---- Adjustable Mold Frame ----
  {
    type: "number",
    key: "frame_flange_width",
    label: "Flange Width",
    group: "frame",
    min: 2,
    max: 60,
    step: 0.5,
    default: 10,
    unit: "mm",
    showIf: isFrameMode,
  },
  {
    type: "number",
    key: "frame_strip_length",
    label: "Strip Length",
    group: "frame",
    min: 20,
    max: 500,
    step: 5,
    default: 160,
    unit: "mm",
    showIf: isFrameMode,
  },
  {
    type: "number",
    key: "frame_batch_count",
    label: "Batch Count",
    group: "frame",
    min: 1,
    max: 20,
    step: 1,
    default: 4,
    showIf: (p) => p.render_mode === "adjustable_frame_batch",
  },
];

export const moldBoxFields: Field[] = [
  {
    type: "number",
    key: "mold_inner_length_x",
    label: "Inner Length (X)",
    group: "geometry",
    min: 10,
    max: 400,
    step: 1,
    default: 80,
    unit: "mm",
  },
  {
    type: "number",
    key: "mold_inner_width_y",
    label: "Inner Width (Y)",
    group: "geometry",
    min: 10,
    max: 400,
    step: 1,
    default: 60,
    unit: "mm",
  },
  {
    type: "number",
    key: "mold_inner_depth_z",
    label: "Inner Depth (Z)",
    group: "geometry",
    min: 2,
    max: 150,
    step: 1,
    default: 20,
    unit: "mm",
  },
  {
    type: "number",
    key: "wall_thickness",
    label: "Wall Thickness",
    group: "geometry",
    min: 1,
    max: 40,
    step: 0.5,
    default: 5,
    unit: "mm",
  },
  {
    type: "number",
    key: "floor_thickness",
    label: "Floor Thickness",
    group: "geometry",
    min: 1,
    max: 40,
    step: 0.5,
    default: 4,
    unit: "mm",
  },
  {
    type: "number",
    key: "draft_angle",
    label: "Draft Angle (Release Taper)",
    group: "geometry",
    min: 0,
    max: 30,
    step: 0.5,
    default: 3,
    unit: "°",
  },
  {
    type: "boolean",
    key: "enable_center_guide",
    label: "Enable Center Guide",
    group: "cavity",
    default: false,
  },
  {
    type: "number",
    key: "guide_length_x",
    label: "Guide Length (X)",
    group: "cavity",
    min: 1,
    max: 300,
    step: 1,
    default: 20,
    unit: "mm",
    showIf: (p) => Boolean(p.enable_center_guide),
  },
  {
    type: "number",
    key: "guide_width_y",
    label: "Guide Width (Y)",
    group: "cavity",
    min: 1,
    max: 300,
    step: 1,
    default: 15,
    unit: "mm",
    showIf: (p) => Boolean(p.enable_center_guide),
  },
];

export function defaultParams(fields: Field[]): ParamValues {
  return Object.fromEntries(fields.map((f) => [f.key, f.default]));
}
