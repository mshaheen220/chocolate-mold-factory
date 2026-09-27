import type { Field, ParamValues } from "./types";
import { computeAutoFitScale, type SvgNaturalSize } from "./utils/svg";

export interface TokenPreset {
  id: "small" | "medium" | "large" | "custom";
  label: string;
  sublabel: string;
  size: number; // Coin diameter (mm)
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
  const size = Number(params.token_size);
  return computeAutoFitScale(natural, size, size);
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

export const medallionFields: Field[] = [
  {
    type: "number",
    key: "svg_scale",
    label: "SVG Scale",
    group: "geometry",
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
    group: "geometry",
    min: 10,
    max: 150,
    step: 1,
    default: 40,
    unit: "mm",
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
  },

  // ---- Border ----
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
  },
  {
    type: "enum",
    key: "border_direction",
    label: "Border Direction",
    group: "border",
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
];

export function defaultParams(fields: Field[]): ParamValues {
  return Object.fromEntries(fields.map((f) => [f.key, f.default]));
}
