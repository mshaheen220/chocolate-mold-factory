import type { ParamValues } from "../types";
import type { SvgNaturalSize } from "./svg";

/** Area of a rounded rectangle (width x height, corner radius r) - exact
 * match for the offset(r)/offset(-r) rounding trick in medallion.scad:
 * area = W*H - r^2*(4-pi). */
function roundedRectArea(width: number, height: number, cornerRadius: number): number {
  if (width <= 0 || height <= 0) return 0;
  const r = Math.max(0, Math.min(cornerRadius, width / 2, height / 2));
  return width * height - r * r * (4 - Math.PI);
}

/**
 * Area of the token's own outline, mirroring token_base_2d() in
 * medallion.scad. `insetOnEachSide` shrinks the shape uniformly inward on
 * every side, mirroring offset(delta=-inset) - used to compute border
 * ring areas as the difference of two inset shapes.
 */
export function tokenShapeArea(
  shape: string,
  size: number,
  length: number,
  cornerRadius: number,
  insetOnEachSide = 0,
): number {
  const w = size - 2 * insetOnEachSide;
  const h = length - 2 * insetOnEachSide;
  if (w <= 0 || h <= 0) return 0;

  if (shape === "circle" || shape === "oval") {
    return (Math.PI * w * h) / 4; // ellipse area = pi * rx * ry = pi * (w/2) * (h/2)
  }
  const r = Math.max(0, cornerRadius - insetOnEachSide);
  return roundedRectArea(w, h, r);
}

/** Outline perimeter of the token's own footprint, for estimating how
 * much outer-wall shell a slice of it would need. */
export function tokenShapePerimeter(shape: string, size: number, length: number, cornerRadius: number): number {
  if (shape === "circle") return Math.PI * size;

  if (shape === "oval") {
    const a = size / 2;
    const b = length / 2;
    // Ramanujan's second approximation - well within estimate-grade accuracy.
    const h = ((a - b) / (a + b)) ** 2;
    return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  }

  // square / rectangle: straight edges plus the four rounded corners'
  // combined arc length (4 quarter-circles = one full circle).
  const r = Math.max(0, Math.min(cornerRadius, size / 2, length / 2));
  return 2 * (size - 2 * r) + 2 * (length - 2 * r) + 2 * Math.PI * r;
}

export interface VolumeBreakdown {
  baseVolumeMm3: number;
  borderVolumeMm3: number;
  reliefVolumeMm3: number;
  totalVolumeMm3: number;
}

/**
 * Estimates the volume of chocolate (in mm^3) a single token/coin cavity
 * would take to fill, from the same geometry the OpenSCAD template
 * generates: a base slab, an optional raised border, and an optional
 * relief bump from an uploaded graphic.
 *
 * The relief is the one inherently approximate term: `svgFillRatio` (from
 * measureSvgFillRatio) is the fraction of the graphic's own bounding box
 * that's actually filled, since most artwork covers only part of its
 * bbox. Pass `null` when no graphic is loaded to omit it entirely.
 */
export function computeTokenVolume(
  params: ParamValues,
  svgNaturalSize: SvgNaturalSize | null,
  svgFillRatio: number | null,
): VolumeBreakdown {
  const shape = String(params.token_shape);
  const size = Number(params.token_size);
  const length = shape === "oval" || shape === "rectangle" ? Number(params.token_length) : size;
  const cornerRadius = Number(params.corner_radius) || 0;
  const baseThickness = Number(params.base_thickness);
  const reliefHeight = Number(params.relief_height);
  const draftAngle = Number(params.draft_angle);
  const borderStyle = String(params.border_style);

  const baseArea = tokenShapeArea(shape, size, length, cornerRadius);
  const baseVolumeMm3 = baseArea * baseThickness;

  // Border volume - mirrors ring_2d() / beaded_ring_2d() in medallion.scad.
  // A recessed border carves material OUT of the base (mirrors the
  // difference() + depth clamp in token()), so it subtracts rather than
  // adds - and can never remove more than the base itself provides.
  let borderVolumeMm3 = 0;
  if (borderStyle !== "none") {
    const borderInset = Number(params.border_inset);
    const borderDirection = String(params.border_direction ?? "raised");
    const borderHeight = Number(params.border_height);

    let crossSectionArea = 0;
    if (borderStyle === "beaded") {
      const beadCount = Number(params.bead_count);
      const beadSize = Number(params.bead_size);
      crossSectionArea = beadCount * Math.PI * (beadSize / 2) ** 2;
    } else {
      const borderWidth = Number(params.border_width);
      const ringArea = (inset: number) =>
        tokenShapeArea(shape, size, length, cornerRadius, inset) -
        tokenShapeArea(shape, size, length, cornerRadius, inset + borderWidth);

      crossSectionArea = Math.max(0, ringArea(borderInset));
      if (borderStyle === "double") {
        const borderGap = Number(params.border_gap);
        crossSectionArea += Math.max(0, ringArea(borderInset + borderWidth + borderGap));
      }
    }

    if (borderDirection === "recessed") {
      const recessDepth = Math.min(borderHeight, Math.max(0, baseThickness - 0.2));
      borderVolumeMm3 = -crossSectionArea * recessDepth;
    } else {
      borderVolumeMm3 = crossSectionArea * borderHeight;
    }
  }

  // Relief volume: a linear_extrude(scale=taperRatio) frustum over the
  // graphic's measured filled area (not its full bounding box).
  let reliefVolumeMm3 = 0;
  if (svgNaturalSize && svgFillRatio !== null) {
    const svgScale = Number(params.svg_scale);
    const bboxArea = svgNaturalSize.width * svgScale * (svgNaturalSize.height * svgScale);
    const filledArea = bboxArea * svgFillRatio;
    const taperRatio = Math.max(0.05, 1 - (2 * reliefHeight * Math.tan((draftAngle * Math.PI) / 180)) / size);
    const topArea = filledArea * taperRatio * taperRatio; // linear scale -> area scales as the square
    // Frustum volume: (h/3) * (A1 + A2 + sqrt(A1*A2)).
    reliefVolumeMm3 = (reliefHeight / 3) * (filledArea + topArea + Math.sqrt(filledArea * topArea));
  }

  return {
    baseVolumeMm3,
    borderVolumeMm3,
    reliefVolumeMm3,
    totalVolumeMm3: Math.max(0, baseVolumeMm3 + borderVolumeMm3 + reliefVolumeMm3),
  };
}

// Mirrors the values shown in printRecommendations.ts (nozzle, walls, top
// shell layers, layer height, infill) - kept as separate constants here
// rather than parsed from those display strings, so update both places if
// the recommendation changes.
const NOZZLE_DIAMETER_MM = 0.2;
const WALL_COUNT = 4; // upper end of the recommended 3-4 perimeters
const SHELL_LAYERS = 7; // midpoint of the recommended 6-8 top shell layers
const LAYER_HEIGHT_MM = 0.09; // midpoint of the recommended 0.08-0.10mm
const INFILL_FRACTION = 0.3; // matches the recommended 30% gyroid infill

/**
 * Estimates how much of a token's total volume actually becomes extruded
 * filament, rather than assuming the whole solid volume prints at 100%
 * density. A slicer keeps the outer walls and top/bottom shell fully
 * solid regardless of infill setting; only the interior left over gets
 * the (much lower) infill percentage. Treating the entire volume as solid
 * would overstate filament usage by roughly 1/infill for anything with
 * meaningful interior volume.
 */
export function estimateFilamentVolumeMm3(params: ParamValues, totalVolumeMm3: number): number {
  const shape = String(params.token_shape);
  const size = Number(params.token_size);
  const length = shape === "oval" || shape === "rectangle" ? Number(params.token_length) : size;
  const cornerRadius = Number(params.corner_radius) || 0;
  const baseThickness = Number(params.base_thickness);

  const footprintArea = tokenShapeArea(shape, size, length, cornerRadius);
  const perimeter = tokenShapePerimeter(shape, size, length, cornerRadius);
  // The relief bump normally sits inset from the token's edge rather than
  // running along the outer wall, so only base_thickness - not the relief
  // height on top of it - contributes to the *outer* wall's height.
  const outerWallHeight = baseThickness;

  const wallThickness = WALL_COUNT * NOZZLE_DIAMETER_MM;
  const shellThickness = SHELL_LAYERS * LAYER_HEIGHT_MM;

  const lateralShellVolume = perimeter * outerWallHeight * wallThickness;
  const topAndBottomShellVolume = footprintArea * shellThickness * 2;
  const shellVolume = Math.min(totalVolumeMm3, lateralShellVolume + topAndBottomShellVolume);

  const interiorVolume = Math.max(0, totalVolumeMm3 - shellVolume);
  return shellVolume + interiorVolume * INFILL_FRACTION;
}

/**
 * Volume of silicone (mm^3) needed to pour a mold around the current
 * token grid, mirroring mold_box() / adjustable_frame_preview() in
 * medallion.scad: the cavity above the floor, minus the volume the token
 * grid itself displaces (silicone doesn't fill where the masters already
 * are). Returns 0 for render modes with no pour cavity at all
 * (single_token, adjustable_frame_strip/batch).
 */
export function estimateSiliconePourVolumeMm3(params: ParamValues, singleTokenVolumeMm3: number): number {
  const renderMode = String(params.render_mode);
  if (renderMode !== "reusable_mold_box" && renderMode !== "adjustable_frame_preview") {
    return 0;
  }

  const shape = String(params.token_shape);
  const tokenSize = Number(params.token_size);
  const tokenLength = shape === "oval" || shape === "rectangle" ? Number(params.token_length) : tokenSize;
  const spacing = Number(params.spacing);
  const gridX = Number(params.grid_x);
  const gridY = Number(params.grid_y);
  const outerMargin = Number(params.outer_margin);
  const siliconeDepth = Number(params.silicone_depth);

  const gridExtent = (count: number, size: number) => count * size + (count - 1) * spacing;
  const innerW = gridExtent(gridX, tokenSize) + 2 * outerMargin;
  const innerH = gridExtent(gridY, tokenLength) + 2 * outerMargin;

  // reusable_mold_box's wall (and therefore its cavity) rises above the
  // floor by base+relief+silicone_depth; the adjustable frame's wall
  // height *is* silicone_depth directly (see frame_strip_solid()).
  const cavityHeight =
    renderMode === "reusable_mold_box"
      ? Number(params.base_thickness) + Number(params.relief_height) + siliconeDepth
      : siliconeDepth;

  const cavityVolume = innerW * innerH * cavityHeight;
  const tokenCount = Math.max(1, Math.round(gridX * gridY));
  const displacedVolume = tokenCount * singleTokenVolumeMm3;

  return Math.max(0, cavityVolume - displacedVolume);
}
