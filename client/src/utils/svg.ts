export interface SvgNaturalSize {
  width: number;
  height: number;
}

/**
 * Reads an SVG's intrinsic size from its viewBox (preferred) or
 * width/height attributes, using the same viewBox-first priority the
 * backend uses when it normalizes the uploaded file (see
 * server/src/lib/svg.ts) so "1 unit here" reliably equals "1mm once
 * imported by OpenSCAD".
 */
export async function readSvgNaturalSize(file: File): Promise<SvgNaturalSize> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Could not parse SVG file");
  }
  const svg = doc.documentElement;

  const viewBox = svg.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  const width = parseFloat(svg.getAttribute("width") ?? "");
  const height = parseFloat(svg.getAttribute("height") ?? "");
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }

  return { width: 100, height: 100 };
}

/**
 * Picks a uniform scale factor so the SVG's natural bounding box fills
 * `fillRatio` of the given target footprint without distorting its aspect
 * ratio, then snaps to the given step for a tidy slider value.
 */
export function computeAutoFitScale(
  natural: SvgNaturalSize,
  targetWidth: number,
  targetHeight: number,
  { fillRatio = 0.82, step = 0.05, min = 0.1, max = 5 } = {},
): number {
  const scaleX = (targetWidth * fillRatio) / natural.width;
  const scaleY = (targetHeight * fillRatio) / natural.height;
  const raw = Math.min(scaleX, scaleY);
  const snapped = Math.round(raw / step) * step;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(3))));
}
