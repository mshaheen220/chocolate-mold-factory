/**
 * OpenSCAD's SVG importer treats bare viewBox units as PostScript points
 * (25.4/72 mm each) unless the root <svg> declares explicit width/height
 * matching the viewBox in real units - confirmed empirically against the
 * pinned OpenSCAD 2021.01 build (viewBox-only files import ~35% of the
 * "1 unit = 1mm" size a naive reading would expect).
 *
 * Rather than replicate that unit-fallback logic (fragile and version
 * specific) on the client for auto-fit sizing, every uploaded SVG is
 * rewritten here so its width/height always match its viewBox 1:1 in mm.
 * That makes "1 viewBox user unit = 1mm inside OpenSCAD" a guarantee the
 * rest of the app (the client's auto-fit scale calculation in particular)
 * can rely on.
 */
export function normalizeSvgForOpenScad(svgText: string): string {
  const svgTagMatch = svgText.match(/<svg\b[^>]*>/i);
  if (!svgTagMatch) return svgText;
  const tag = svgTagMatch[0];

  const viewBoxMatch = tag.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  let width: number | null = null;
  let height: number | null = null;

  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
      [, , width, height] = parts;
    }
  }

  if (width === null || height === null) {
    const widthAttr = tag.match(/\bwidth\s*=\s*["']([\d.]+)/i);
    const heightAttr = tag.match(/\bheight\s*=\s*["']([\d.]+)/i);
    width = widthAttr ? Number(widthAttr[1]) : 100;
    height = heightAttr ? Number(heightAttr[1]) : 100;
  }

  let newTag = tag.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, "");
  newTag = newTag.replace(/^<svg\b/i, `<svg width="${width}mm" height="${height}mm"`);
  if (!viewBoxMatch) {
    newTag = newTag.replace(/^(<svg\b[^>]*?)(\/?>)$/i, `$1 viewBox="0 0 ${width} ${height}"$2`);
  }

  return svgText.replace(tag, newTag);
}
