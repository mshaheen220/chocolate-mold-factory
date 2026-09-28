import { pieceShapeOf, tokenLengthOf } from "../paramSchemas";
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
 * Area of the coin's own outline, mirroring token_base_2d() in
 * medallion.scad. `insetOnEachSide` shrinks the shape uniformly inward on
 * every side, mirroring offset(delta=-inset) - used to compute border
 * ring areas as the difference of two inset shapes.
 */
export function tokenShapeArea(params: ParamValues, insetOnEachSide = 0): number {
  const shape = pieceShapeOf(params);
  const w = Number(params.token_size) - 2 * insetOnEachSide;
  const h = tokenLengthOf(params) - 2 * insetOnEachSide;
  if (w <= 0 || h <= 0) return 0;

  if (shape === "square" || shape === "rectangle") {
    const r = Math.max(0, Number(params.corner_radius) - insetOnEachSide);
    return roundedRectArea(w, h, r);
  }
  return (Math.PI * w * h) / 4; // ellipse area = pi * (w/2) * (h/2)
}

/** Outline perimeter of the coin's own footprint, for estimating how much
 * outer-wall shell a slice of it would need. */
export function tokenShapePerimeter(params: ParamValues): number {
  const shape = pieceShapeOf(params);
  const size = Number(params.token_size);
  const length = tokenLengthOf(params);

  if (shape === "square" || shape === "rectangle") {
    // Straight edges plus the four rounded corners' combined arc length
    // (4 quarter-circles = one full circle).
    const r = Math.max(0, Math.min(Number(params.corner_radius), size / 2, length / 2));
    return 2 * (size - 2 * r) + 2 * (length - 2 * r) + 2 * Math.PI * r;
  }

  const a = size / 2;
  const b = length / 2;
  // Ramanujan's second approximation - exact for a circle, well within
  // estimate-grade accuracy for an oval.
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

export interface VolumeBreakdown {
  baseVolumeMm3: number;
  borderVolumeMm3: number;
  reliefVolumeMm3: number;
  totalVolumeMm3: number;
}

/**
 * Estimates the volume of chocolate (in mm^3) a single coin cavity would
 * take to fill, from the same geometry the OpenSCAD template generates: a
 * base slab, an optional raised border, and an optional relief bump from
 * an uploaded graphic.
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
  const minSide = Math.min(Number(params.token_size), tokenLengthOf(params));
  const baseThickness = Number(params.base_thickness);
  const reliefHeight = Number(params.relief_height);
  const draftAngle = Number(params.draft_angle);
  const borderStyle = String(params.border_style);

  const baseArea = tokenShapeArea(params);
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
      const ringArea = (inset: number) => tokenShapeArea(params, inset) - tokenShapeArea(params, inset + borderWidth);

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

  // Relief volume. Raised: a linear_extrude(scale=taperRatio) frustum over
  // the graphic's measured filled area (not its full bounding box).
  // Recessed: carves that same filled area straight down out of the base
  // (no taper - mirrors token_body()'s recessed branch in medallion.scad),
  // capped short of the full base thickness the same way a recessed
  // border is.
  let reliefVolumeMm3 = 0;
  if (svgNaturalSize && svgFillRatio !== null) {
    const svgScale = Number(params.svg_scale);
    const bboxArea = svgNaturalSize.width * svgScale * (svgNaturalSize.height * svgScale);
    const filledArea = bboxArea * svgFillRatio;
    const reliefDirection = String(params.relief_direction ?? "raised");

    if (reliefDirection === "recessed") {
      const recessDepth = Math.min(reliefHeight, Math.max(0, baseThickness - 0.2));
      reliefVolumeMm3 = -filledArea * recessDepth;
    } else {
      const taperRatio = Math.max(0.05, 1 - (2 * reliefHeight * Math.tan((draftAngle * Math.PI) / 180)) / minSide);
      const topArea = filledArea * taperRatio * taperRatio; // linear scale -> area scales as the square
      // Frustum volume: (h/3) * (A1 + A2 + sqrt(A1*A2)).
      reliefVolumeMm3 = (reliefHeight / 3) * (filledArea + topArea + Math.sqrt(filledArea * topArea));
    }
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
const INFILL_FRACTION = 0.04; // matches the recommended 4% rectilinear infill

export interface Footprint {
  areaMm2: number;
  perimeterMm: number;
  baseThickness: number;
}

/** The round coin's own footprint, mirroring token_base_2d() in medallion.scad. */
export function coinFootprint(params: ParamValues): Footprint {
  return {
    areaMm2: tokenShapeArea(params),
    perimeterMm: tokenShapePerimeter(params),
    baseThickness: Number(params.base_thickness),
  };
}

/**
 * Estimates how much of a piece's total volume actually becomes extruded
 * filament, rather than assuming the whole solid volume prints at 100%
 * density. A slicer keeps the outer walls and top/bottom shell fully
 * solid regardless of infill setting; only the interior left over gets
 * the (much lower) infill percentage. Treating the entire volume as solid
 * would overstate filament usage by roughly 1/infill for anything with
 * meaningful interior volume.
 */
export function estimateFilamentVolumeMm3(footprint: Footprint, totalVolumeMm3: number): number {
  // The relief normally sits inset from the piece's edge rather than
  // running along the outer wall, so only base_thickness - not the relief
  // height on top of it - contributes to the *outer* wall's height.
  const outerWallHeight = footprint.baseThickness;

  const wallThickness = WALL_COUNT * NOZZLE_DIAMETER_MM;
  const shellThickness = SHELL_LAYERS * LAYER_HEIGHT_MM;

  const lateralShellVolume = footprint.perimeterMm * outerWallHeight * wallThickness;
  const topAndBottomShellVolume = footprint.areaMm2 * shellThickness * 2;
  const shellVolume = Math.min(totalVolumeMm3, lateralShellVolume + topAndBottomShellVolume);

  const interiorVolume = Math.max(0, totalVolumeMm3 - shellVolume);
  return shellVolume + interiorVolume * INFILL_FRACTION;
}
