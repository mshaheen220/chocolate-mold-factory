import type { Field, ParamValues, PieceMode, PieceShape } from "./types";
import { computeAutoFitScale, type SvgNaturalSize } from "./utils/svg";

// Matches the server's version_label spec (server/src/lib/validation.ts) -
// keep both in sync if this changes. Restricted to what the engraved
// font can render cleanly, not for injection safety (the server already
// guards that generically for every string param).
export const VERSION_LABEL_MAX_LENGTH = 16;
export const VERSION_LABEL_PATTERN = /^[A-Za-z0-9 .#/_-]*$/;

/** Strips any character the back-label engraving can't accept, for live
 * filtering as the user types rather than surfacing a validation error
 * only after they hit Preview/Render. */
export function sanitizeVersionLabel(value: string): string {
  return Array.from(value)
    .filter((ch) => VERSION_LABEL_PATTERN.test(ch))
    .join("")
    .slice(0, VERSION_LABEL_MAX_LENGTH);
}

export interface TokenPreset {
  id: "small" | "medium" | "large" | "custom";
  label: string;
  sublabel: string;
  size: number; // Diameter for circles, width for other shapes (mm)
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
 * stays fit to the coin whichever one last changed the coin's size. */
export function autoFitScaleForToken(natural: SvgNaturalSize, params: ParamValues): number {
  return computeAutoFitScale(natural, Number(params.token_size), tokenLengthOf(params));
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

const hasBorder = (p: ParamValues) => p.border_style !== "none";

const PIECE_SHAPES: readonly PieceShape[] = ["circle", "oval", "square", "rectangle", "contour"];

export function pieceShapeOf(params: ParamValues): PieceShape {
  const value = String(params.piece_shape);
  return (PIECE_SHAPES as readonly string[]).includes(value) ? (value as PieceShape) : "circle";
}

export function pieceModeOf(params: ParamValues): PieceMode {
  return pieceShapeOf(params) === "contour" ? "contour" : "coin";
}

/** Contoured piece with a smooth plate tier underneath the design. */
export function hasBasePlate(params: ParamValues): boolean {
  return pieceModeOf(params) === "contour" && params.base_plate === "hull";
}

/** Oval and rectangle have an independent length; circle and square are locked to their width. */
export function hasIndependentLength(params: ParamValues): boolean {
  const shape = pieceShapeOf(params);
  return shape === "oval" || shape === "rectangle";
}

/** The coin's Y-axis size, mirroring token_effective_length() in medallion.scad. */
export function tokenLengthOf(params: ParamValues): number {
  return hasIndependentLength(params) ? Number(params.token_length) : Number(params.token_size);
}

/** Whether a field applies to the current mode and its own showIf condition. */
export function isFieldVisible(field: Field, params: ParamValues): boolean {
  if (field.mode && field.mode !== pieceModeOf(params)) return false;
  return !field.showIf || field.showIf(params);
}

/** Just the params the server's schema for the current mode expects. */
export function paramsForServer(fields: Field[], params: ParamValues): ParamValues {
  const mode = pieceModeOf(params);
  const result: ParamValues = Object.fromEntries(
    fields.filter((f) => !f.clientOnly && (!f.mode || f.mode === mode)).map((f) => [f.key, params[f.key]]),
  );
  if (mode === "coin") result.token_shape = pieceShapeOf(params);
  return result;
}

export const medallionFields: Field[] = [
  {
    type: "enum",
    key: "piece_shape",
    label: "Piece Shape",
    group: "geometry",
    default: "circle",
    clientOnly: true,
    options: [
      { value: "circle", label: "Circle" },
      { value: "oval", label: "Oval" },
      { value: "square", label: "Square" },
      { value: "rectangle", label: "Rectangle" },
      { value: "contour", label: "Contour (follow the artwork's outline)" },
    ],
  },
  {
    type: "number",
    key: "piece_size",
    label: "Piece Size (longest side)",
    group: "geometry",
    mode: "contour",
    min: 10,
    max: 150,
    step: 1,
    default: 50,
    unit: "mm",
  },
  {
    type: "number",
    key: "outline_margin",
    label: "Outline Margin",
    group: "geometry",
    mode: "contour",
    min: 0,
    max: 5,
    step: 0.1,
    default: 0,
    unit: "mm",
  },
  {
    type: "enum",
    key: "base_plate",
    label: "Base Plate",
    group: "geometry",
    mode: "contour",
    default: "none",
    options: [
      { value: "none", label: "None (outline is the design itself)" },
      { value: "hull", label: "Smooth plate under the design" },
    ],
  },
  {
    type: "number",
    key: "plate_border",
    label: "Plate Border",
    group: "geometry",
    mode: "contour",
    min: 0,
    max: 20,
    step: 0.5,
    default: 4,
    unit: "mm",
    showIf: hasBasePlate,
  },
  {
    type: "number",
    key: "plate_thickness",
    label: "Plate Thickness",
    group: "geometry",
    mode: "contour",
    min: 0.5,
    max: 10,
    step: 0.1,
    default: 2,
    unit: "mm",
    showIf: hasBasePlate,
  },
  {
    type: "enum",
    key: "contour_relief_direction",
    label: "Relief Direction",
    group: "geometry",
    mode: "contour",
    // Applied client-side (it flips the per-layer heights before upload),
    // so the server never sees it.
    clientOnly: true,
    default: "raised",
    options: [
      { value: "raised", label: "Raised (details stand out)" },
      { value: "recessed", label: "Recessed (details inset)" },
    ],
  },
  {
    type: "number",
    key: "speck_filter",
    label: "Remove Detached Bits Under",
    group: "layers",
    mode: "contour",
    clientOnly: true,
    min: 0,
    max: 20,
    step: 0.5,
    default: 2,
    unit: "%",
  },
  {
    type: "number",
    key: "svg_scale",
    label: "SVG Scale",
    group: "geometry",
    mode: "coin",
    min: 0.05,
    max: 2.5,
    step: 0.01,
    default: 1,
  },
  {
    type: "number",
    key: "svg_offset_x",
    label: "SVG X Offset",
    group: "geometry",
    mode: "coin",
    min: -50,
    max: 50,
    step: 0.5,
    default: 0,
    unit: "mm",
  },
  {
    type: "number",
    key: "svg_offset_y",
    label: "SVG Y Offset",
    group: "geometry",
    mode: "coin",
    min: -50,
    max: 50,
    step: 0.5,
    default: 0,
    unit: "mm",
  },
  {
    type: "number",
    key: "token_size",
    label: "Coin Diameter",
    labelFor: (p) => ({ circle: "Coin Diameter", square: "Side Length" })[pieceShapeOf(p) as string] ?? "Width (X)",
    group: "geometry",
    mode: "coin",
    min: 10,
    max: 100,
    step: 1,
    default: 40,
    unit: "mm",
  },
  {
    type: "number",
    key: "token_length",
    label: "Length (Y)",
    group: "geometry",
    mode: "coin",
    min: 10,
    max: 100,
    step: 1,
    default: 60,
    unit: "mm",
    showIf: hasIndependentLength,
  },
  {
    type: "number",
    key: "corner_radius",
    label: "Corner Radius",
    group: "geometry",
    mode: "coin",
    min: 0,
    max: 50,
    step: 0.5,
    default: 4,
    unit: "mm",
    showIf: (p) => pieceShapeOf(p) === "square" || pieceShapeOf(p) === "rectangle",
  },
  {
    type: "number",
    key: "base_thickness",
    label: "Base Thickness",
    labelFor: (p) => (hasBasePlate(p) ? "Design Height Above Plate" : "Base Thickness"),
    group: "geometry",
    min: 0.5,
    max: 10,
    step: 0.1,
    default: 3,
    unit: "mm",
  },
  {
    type: "number",
    key: "relief_height",
    label: "Relief Height",
    group: "geometry",
    mode: "coin",
    min: 0.2,
    max: 5,
    step: 0.1,
    default: 1.5,
    unit: "mm",
  },
  {
    type: "enum",
    key: "relief_direction",
    label: "Relief Direction",
    group: "geometry",
    mode: "coin",
    default: "raised",
    options: [
      { value: "raised", label: "Raised" },
      { value: "recessed", label: "Recessed" },
    ],
  },
  {
    type: "number",
    key: "draft_angle",
    label: "Draft Angle",
    group: "geometry",
    mode: "coin",
    min: 0,
    max: 30,
    step: 0.5,
    default: 3,
    unit: "°",
  },

  // ---- Border ----
  {
    type: "enum",
    key: "border_style",
    label: "Border Style",
    group: "border",
    mode: "coin",
    default: "none",
    options: [
      { value: "none", label: "None" },
      { value: "single", label: "Single Ring" },
      { value: "double", label: "Double Ring" },
      { value: "beaded", label: "Beaded" },
    ],
  },
  {
    type: "enum",
    key: "border_direction",
    label: "Border Direction",
    group: "border",
    mode: "coin",
    default: "raised",
    options: [
      { value: "raised", label: "Raised" },
      { value: "recessed", label: "Recessed" },
    ],
    showIf: hasBorder,
  },
  {
    type: "number",
    key: "border_inset",
    label: "Border Inset",
    group: "border",
    mode: "coin",
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
    mode: "coin",
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
    mode: "coin",
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
    mode: "coin",
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
    mode: "coin",
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
    mode: "coin",
    min: 0.5,
    max: 15,
    step: 0.1,
    default: 2.5,
    unit: "mm",
    showIf: (p) => hasBorder(p) && p.border_style === "beaded",
  },

  // ---- Back Label ----
  {
    type: "string",
    key: "version_label",
    label: "Version Label",
    group: "label",
    maxLength: VERSION_LABEL_MAX_LENGTH,
    placeholder: "e.g. V1 (blank = no label)",
    default: "",
    sanitize: sanitizeVersionLabel,
  },
];

export function defaultParams(fields: Field[]): ParamValues {
  return Object.fromEntries(fields.map((f) => [f.key, f.default]));
}
