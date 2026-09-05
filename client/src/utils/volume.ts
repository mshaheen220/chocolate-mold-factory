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
function tokenShapeArea(
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
