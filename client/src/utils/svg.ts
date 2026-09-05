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
/**
 * Rasterizes the SVG onto an offscreen canvas and measures what fraction
 * of its bounding box is actually filled (non-transparent). Used for
 * volume estimation: most artwork covers only a fraction of its own
 * bounding box, so using the bbox area directly would overstate how much
 * chocolate the relief adds by a wide margin. A blob: URL for a local
 * File is same-origin, so this doesn't taint the canvas.
 */
export async function measureSvgFillRatio(file: File): Promise<number> {
  const SAMPLE_SIZE = 128;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to rasterize SVG"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 1;

    ctx.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    let filled = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 32) filled++; // alpha channel above a small anti-aliasing noise floor
    }
    return filled / (SAMPLE_SIZE * SAMPLE_SIZE);
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
