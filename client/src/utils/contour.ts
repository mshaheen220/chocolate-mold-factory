/**
 * Contoured pieces: turns an uploaded SVG into per-color layers whose union
 * becomes the chocolate piece's outline, with each color raised (or
 * engraved) by its own height. See server/templates/contour.scad for the
 * geometry side.
 *
 * All of the SVG understanding happens here in the browser rather than on
 * the server, because the browser already resolves everything that makes
 * SVG hard to parse by hand - CSS classes and inherited fills (via
 * getComputedStyle) and nested/group transforms (via getScreenCTM). Every
 * shape is flattened to plain polygons in the root's user space, so the
 * server and OpenSCAD only ever see simple `M ... L ... Z` paths.
 */

export type Point = [number, number];
export type Ring = Point[];

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ArtElement {
  color: string;
  fillRule: "nonzero" | "evenodd";
  rings: Ring[];
}

export interface ArtColor {
  key: string;
  /** Fraction of all painted artwork this color is visible in (0-1), accounting for shapes painted over it. */
  coverage: number;
}

export interface ArtworkModel {
  /** Every filled shape, in paint order (bottom to top). */
  elements: ArtElement[];
  /** Unique fill colors, most visible first. */
  colors: ArtColor[];
  bounds: Bounds;
  /** Elements that couldn't be converted (text, <use>, images) and were ignored. */
  skippedCount: number;
}

export interface ColorSetting {
  /** Part of the chocolate piece; false = background (cut away wherever it's painted on top). */
  included: boolean;
  /** mm above (+) or into (-) the base's top face. */
  height: number;
}

export type ColorSettings = Record<string, ColorSetting>;

export const GRADIENT_COLOR_KEY = "gradient";

// Default height for every color other than the most visible one, which
// becomes the base level (0). Deliberately modest - tall, thin reliefs
// are prone to tearing when the silicone mold is peeled off.
export const DEFAULT_CONTOUR_RELIEF_HEIGHT = 1.2;

// Outline simplification tolerance, in mm on the final piece. Both are far
// below what an FDM nozzle can resolve, but traced artwork carries so many
// curve points that leaving them in makes OpenSCAD's CGAL union take
// minutes rather than seconds (measured: ~80s -> ~5s at 0.05mm on the
// panther-paw demo).
export const FINAL_TOLERANCE_MM = 0.05;
export const DRAFT_TOLERANCE_MM = 0.15;

// ---------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------

export function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(sum) / 2;
}

function ringBounds(ring: Ring): Bounds {
  const b = emptyBounds();
  for (const p of ring) extendBounds(b, p);
  return b;
}

function emptyBounds(): Bounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function extendBounds(b: Bounds, [x, y]: Point): void {
  if (x < b.minX) b.minX = x;
  if (y < b.minY) b.minY = y;
  if (x > b.maxX) b.maxX = x;
  if (y > b.maxY) b.maxY = y;
}

function boundsOverlap(a: Bounds, b: Bounds, pad = 0): boolean {
  return a.minX - pad <= b.maxX && b.minX - pad <= a.maxX && a.minY - pad <= b.maxY && b.minY - pad <= a.maxY;
}

function pointInRing([x, y]: Point, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToSegmentSq([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

/** Whether two rings overlap or come within `eps` of each other. */
function ringsTouch(a: Ring, b: Ring, eps: number): boolean {
  const epsSq = eps * eps;
  for (const p of a) {
    for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
      if (distanceToSegmentSq(p, b[j], b[i]) <= epsSq) return true;
    }
  }
  return pointInRing(a[0], b) || pointInRing(b[0], a);
}

/** A few vertices spread around the ring - more robust than a single test
 * point when traced shapes share boundaries exactly (a gold highlight's
 * outline often coincides with the blue hole it sits in). */
function sampleVertices(ring: Ring, count = 5): Point[] {
  const step = Math.max(1, Math.floor(ring.length / count));
  const samples: Point[] = [];
  for (let i = 0; i < ring.length && samples.length < count; i += step) samples.push(ring[i]);
  return samples;
}

/** Douglas-Peucker on a closed ring (split at the vertex farthest from the
 * start first - a closed ring's own endpoints coincide, which would give
 * the plain algorithm a zero-length baseline). */
export function simplifyRing(ring: Ring, tolerance: number): Ring {
  if (ring.length <= 4 || tolerance <= 0) return ring;
  let far = 0;
  let farDist = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  }
  const first = simplifyOpen(ring.slice(0, far + 1), tolerance);
  const second = simplifyOpen([...ring.slice(far), ring[0]], tolerance);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

function simplifyOpen(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const tolSq = tolerance * tolerance;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = -1;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distanceToSegmentSq(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolSq) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringPerimeter(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]);
  }
  return sum;
}

/** Andrew's monotone chain - mirrors OpenSCAD's hull() for the base plate. */
export function convexHull(points: Point[]): Ring {
  if (points.length < 3) return points.slice();
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// ---------------------------------------------------------------------
// SVG path data -> polygons
// ---------------------------------------------------------------------

/**
 * Flattens SVG path data into closed rings (one per subpath - filling
 * treats every subpath as implicitly closed). `step` is the target segment
 * length for curves, in the path's own units.
 */
export function flattenPathData(d: string, step: number): Ring[] {
  const rings: Ring[] = [];
  let ring: Ring = [];
  let pos = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  // Reflection points for the smooth S/T commands.
  let lastCtrlX = 0;
  let lastCtrlY = 0;
  let lastCmd = "";

  const skipSeparators = () => {
    while (pos < d.length && /[\s,]/.test(d[pos])) pos++;
  };
  const readNumber = (): number => {
    skipSeparators();
    const match = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(pos, pos + 64));
    if (!match) throw new Error(`Malformed path data near "${d.slice(pos, pos + 16)}"`);
    pos += match[0].length;
    return Number(match[0]);
  };
  // Arc flags may be packed with no separator ("a5 5 0 01 10 10").
  const readFlag = (): number => {
    skipSeparators();
    const ch = d[pos];
    if (ch !== "0" && ch !== "1") throw new Error("Malformed arc flag in path data");
    pos++;
    return Number(ch);
  };
  const flush = () => {
    if (ring.length >= 3) rings.push(ring);
    ring = [];
  };
  const lineTo = (x: number, y: number) => {
    if (ring.length === 0) ring.push([cx, cy]);
    ring.push([x, y]);
    cx = x;
    cy = y;
  };
  const segmentsFor = (length: number, max = 64) => Math.max(2, Math.min(max, Math.ceil(length / step)));

  const cubicTo = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    const x0 = cx;
    const y0 = cy;
    const approxLen = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2);
    const n = segmentsFor(approxLen);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const mt = 1 - t;
      const a = mt * mt * mt;
      const b = 3 * mt * mt * t;
      const c = 3 * mt * t * t;
      const e = t * t * t;
      lineTo(a * x0 + b * x1 + c * x2 + e * x, a * y0 + b * y1 + c * y2 + e * y);
    }
    lastCtrlX = x2;
    lastCtrlY = y2;
  };

  const quadTo = (x1: number, y1: number, x: number, y: number) => {
    const x0 = cx;
    const y0 = cy;
    const n = segmentsFor(Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x - x1, y - y1));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const mt = 1 - t;
      lineTo(mt * mt * x0 + 2 * mt * t * x1 + t * t * x, mt * mt * y0 + 2 * mt * t * y1 + t * t * y);
    }
    lastCtrlX = x1;
    lastCtrlY = y1;
  };

  // Endpoint -> center parameterization, per SVG 1.1 implementation notes F.6.5.
  const arcTo = (rxIn: number, ryIn: number, rotationDeg: number, largeArc: number, sweep: number, x: number, y: number) => {
    let rx = Math.abs(rxIn);
    let ry = Math.abs(ryIn);
    if (rx === 0 || ry === 0 || (x === cx && y === cy)) {
      lineTo(x, y);
      return;
    }
    const phi = (rotationDeg * Math.PI) / 180;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const dx2 = (cx - x) / 2;
    const dy2 = (cy - y) / 2;
    const x1p = cosPhi * dx2 + sinPhi * dy2;
    const y1p = -sinPhi * dx2 + cosPhi * dy2;
    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) {
      rx *= Math.sqrt(lambda);
      ry *= Math.sqrt(lambda);
    }
    const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
    const cxp = (coef * rx * y1p) / ry;
    const cyp = (-coef * ry * x1p) / rx;
    const centerX = cosPhi * cxp - sinPhi * cyp + (cx + x) / 2;
    const centerY = sinPhi * cxp + cosPhi * cyp + (cy + y) / 2;
    const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sweep && delta > 0) delta -= 2 * Math.PI;
    if (sweep && delta < 0) delta += 2 * Math.PI;

    const n = segmentsFor(Math.abs(delta) * Math.max(rx, ry), 180);
    for (let i = 1; i <= n; i++) {
      const t = theta1 + (delta * i) / n;
      const px = rx * Math.cos(t);
      const py = ry * Math.sin(t);
      if (i === n) {
        lineTo(x, y); // land exactly on the endpoint despite float drift
      } else {
        lineTo(cosPhi * px - sinPhi * py + centerX, sinPhi * px + cosPhi * py + centerY);
      }
    }
  };

  for (skipSeparators(); pos < d.length; skipSeparators()) {
    if (/[a-zA-Z]/.test(d[pos])) {
      cmd = d[pos++];
    } else if (!cmd) {
      throw new Error("Path data must start with a command");
    }
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    const upper = cmd.toUpperCase();

    switch (upper) {
      case "M": {
        flush();
        cx = readNumber() + ox;
        cy = readNumber() + oy;
        startX = cx;
        startY = cy;
        ring = [[cx, cy]];
        // Extra coordinate pairs after a moveto are implicit linetos.
        cmd = rel ? "l" : "L";
        break;
      }
      case "L":
        lineTo(readNumber() + ox, readNumber() + oy);
        break;
      case "H":
        lineTo(readNumber() + ox, cy);
        break;
      case "V":
        lineTo(cx, readNumber() + oy);
        break;
      case "C":
        cubicTo(readNumber() + ox, readNumber() + oy, readNumber() + ox, readNumber() + oy, readNumber() + ox, readNumber() + oy);
        break;
      case "S": {
        const reflect = lastCmd === "C" || lastCmd === "S";
        const x1 = reflect ? 2 * cx - lastCtrlX : cx;
        const y1 = reflect ? 2 * cy - lastCtrlY : cy;
        cubicTo(x1, y1, readNumber() + ox, readNumber() + oy, readNumber() + ox, readNumber() + oy);
        break;
      }
      case "Q":
        quadTo(readNumber() + ox, readNumber() + oy, readNumber() + ox, readNumber() + oy);
        break;
      case "T": {
        const reflect = lastCmd === "Q" || lastCmd === "T";
        const x1 = reflect ? 2 * cx - lastCtrlX : cx;
        const y1 = reflect ? 2 * cy - lastCtrlY : cy;
        quadTo(x1, y1, readNumber() + ox, readNumber() + oy);
        break;
      }
      case "A": {
        const rx = readNumber();
        const ry = readNumber();
        const rotation = readNumber();
        const largeArc = readFlag();
        const sweep = readFlag();
        arcTo(rx, ry, rotation, largeArc, sweep, readNumber() + ox, readNumber() + oy);
        break;
      }
      case "Z":
        flush();
        cx = startX;
        cy = startY;
        break;
      default:
        throw new Error(`Unsupported path command "${cmd}"`);
    }
    lastCmd = upper;
    // Every other command repeats while more numbers follow; Z takes none,
    // so a number right after it is malformed.
    if (upper === "Z") cmd = "";
  }
  flush();
  return rings;
}

// ---------------------------------------------------------------------
// SVG document -> ArtworkModel
// ---------------------------------------------------------------------

const NON_RENDERED_ANCESTORS = "defs, clipPath, mask, symbol, pattern, marker, linearGradient, radialGradient";

function ellipseRing(cx: number, cy: number, rx: number, ry: number, step: number): Ring {
  const n = Math.max(24, Math.min(256, Math.ceil((2 * Math.PI * Math.max(rx, ry)) / step)));
  return Array.from({ length: n }, (_, i): Point => {
    const t = (2 * Math.PI * i) / n;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  });
}

function rectRing(el: SVGRectElement, step: number): Ring {
  const x = el.x.baseVal.value;
  const y = el.y.baseVal.value;
  const w = el.width.baseVal.value;
  const h = el.height.baseVal.value;
  if (w <= 0 || h <= 0) return [];
  const rxAttr = el.getAttribute("rx");
  const ryAttr = el.getAttribute("ry");
  let rx = rxAttr !== null ? el.rx.baseVal.value : ryAttr !== null ? el.ry.baseVal.value : 0;
  let ry = ryAttr !== null ? el.ry.baseVal.value : rx;
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry, h / 2);
  if (rx <= 0 || ry <= 0) {
    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
  }
  const d = `M${x + rx},${y} H${x + w - rx} A${rx},${ry} 0 0 1 ${x + w},${y + ry} V${y + h - ry} A${rx},${ry} 0 0 1 ${x + w - rx},${y + h} H${x + rx} A${rx},${ry} 0 0 1 ${x},${y + h - ry} V${y + ry} A${rx},${ry} 0 0 1 ${x + rx},${y} Z`;
  return flattenPathData(d, step)[0] ?? [];
}

function elementRings(el: SVGGeometryElement, step: number): Ring[] {
  switch (el.tagName.toLowerCase()) {
    case "path":
      return flattenPathData(el.getAttribute("d") ?? "", step);
    case "rect":
      return [rectRing(el as SVGRectElement, step)];
    case "circle": {
      const c = el as SVGCircleElement;
      const r = c.r.baseVal.value;
      return r > 0 ? [ellipseRing(c.cx.baseVal.value, c.cy.baseVal.value, r, r, step)] : [];
    }
    case "ellipse": {
      const e = el as SVGEllipseElement;
      const rx = e.rx.baseVal.value;
      const ry = e.ry.baseVal.value;
      return rx > 0 && ry > 0 ? [ellipseRing(e.cx.baseVal.value, e.cy.baseVal.value, rx, ry, step)] : [];
    }
    case "polygon":
    case "polyline": {
      const pts = (el as SVGPolygonElement).points;
      const ring: Ring = [];
      for (let i = 0; i < pts.numberOfItems; i++) {
        const p = pts.getItem(i);
        ring.push([p.x, p.y]);
      }
      return [ring];
    }
    default:
      return [];
  }
}

function parseCssColor(value: string): { key: string; alpha: number } | null {
  if (!value || value === "none") return null;
  if (value.startsWith("url(")) return { key: GRADIENT_COLOR_KEY, alpha: 1 };
  const match = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/.exec(value);
  if (!match) return null;
  const hex = [match[1], match[2], match[3]]
    .map((c) => Math.round(Number(c)).toString(16).padStart(2, "0"))
    .join("");
  const alphaRaw = match[4];
  const alpha = alphaRaw === undefined ? 1 : alphaRaw.endsWith("%") ? parseFloat(alphaRaw) / 100 : Number(alphaRaw);
  return { key: `#${hex}`, alpha };
}

function isHidden(el: Element): boolean {
  for (let node: Element | null = el; node && node.tagName.toLowerCase() !== "svg"; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none") return true;
  }
  return getComputedStyle(el).visibility === "hidden";
}

/** Near-white colors are usually the paper/background in traced logos rather than part of the design. */
export function isLikelyBackground(key: string): boolean {
  if (!key.startsWith("#") || key.length !== 7) return false;
  const channels = [1, 3, 5].map((i) => parseInt(key.slice(i, i + 2), 16));
  return channels.every((c) => c >= 235);
}

export async function analyzeArtwork(file: File): Promise<ArtworkModel> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("Could not parse SVG file");

  // Mounted (off-screen) so the browser computes styles and transforms for
  // us. Not display:none, which would leave getScreenCTM() null - and not
  // visibility:hidden either, which every shape would inherit and then be
  // skipped as hidden artwork.
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:512px;height:512px;opacity:0;pointer-events:none;";
  const svg = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
  svg.setAttribute("width", "512");
  svg.setAttribute("height", "512");
  host.appendChild(svg);
  document.body.appendChild(host);

  try {
    const rootCtm = svg.getScreenCTM();
    if (!rootCtm) throw new Error("Could not measure SVG layout");
    const rootInverse = rootCtm.inverse();

    const vb = svg.viewBox.baseVal;
    const refSize = vb && vb.width > 0 ? Math.max(vb.width, vb.height) : 512;
    const step = refSize / 1500;

    const elements: ArtElement[] = [];
    let skippedCount = 0;
    const bounds = emptyBounds();

    for (const el of Array.from(svg.querySelectorAll("*"))) {
      const tag = el.tagName.toLowerCase();
      if (el.closest(NON_RENDERED_ANCESTORS)) continue;
      if (["text", "use", "image", "foreignobject"].includes(tag)) {
        skippedCount++;
        continue;
      }
      if (!["path", "rect", "circle", "ellipse", "polygon", "polyline"].includes(tag)) continue;
      if (isHidden(el)) continue;

      const style = getComputedStyle(el);
      const fill = parseCssColor(style.fill);
      if (!fill || fill.alpha === 0 || Number(style.fillOpacity) === 0) continue;

      const geom = el as SVGGeometryElement;
      const ctm = geom.getScreenCTM();
      if (!ctm) continue;
      const m = rootInverse.multiply(ctm);

      let rings: Ring[];
      try {
        rings = elementRings(geom, step);
      } catch {
        skippedCount++;
        continue;
      }
      const transformed = rings
        .filter((r) => r.length >= 3)
        .map((r) =>
          r.map(([x, y]): Point => {
            const p: Point = [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
            extendBounds(bounds, p);
            return p;
          }),
        );
      if (transformed.length === 0) continue;

      elements.push({
        color: fill.key,
        fillRule: style.fillRule === "evenodd" ? "evenodd" : "nonzero",
        rings: transformed,
      });
    }

    if (elements.length === 0) {
      throw new Error("No filled shapes found in this SVG - a contoured piece needs filled (not stroke-only) artwork");
    }

    const colorKeys = Array.from(new Set(elements.map((e) => e.color)));
    const counts = rasterizeCoverage(
      elements.map((e) => ({ element: e, index: colorKeys.indexOf(e.color) })),
      bounds,
      colorKeys.length,
    );
    const total = counts.pixelCounts.reduce((a, b) => a + b, 0) || 1;
    const colors = colorKeys
      .map((key, i) => ({ key, coverage: counts.pixelCounts[i] / total }))
      .sort((a, b) => b.coverage - a.coverage);

    return { elements, colors, bounds, skippedCount };
  } finally {
    host.remove();
  }
}

export function defaultColorSettings(model: ArtworkModel): ColorSettings {
  const settings: ColorSettings = {};
  let baseAssigned = false;
  for (const { key } of model.colors) {
    const included = !isLikelyBackground(key);
    let height = 0;
    if (included && baseAssigned) height = DEFAULT_CONTOUR_RELIEF_HEIGHT;
    if (included) baseAssigned = true;
    settings[key] = { included, height };
  }
  return settings;
}

// ---------------------------------------------------------------------
// Rasterized coverage (handles occlusion by later shapes exactly the way
// the SVG itself paints)
// ---------------------------------------------------------------------

const RASTER_SIZE = 256;

interface RasterItem {
  element: ArtElement;
  /** Bucket to count this element's visible pixels into; null erases (background). */
  index: number | null;
}

interface RasterResult {
  pixelCounts: number[];
  /** Silhouette boundary length in pixels (π/4-corrected Manhattan estimate). */
  boundaryPixels: number;
  /** Size of one pixel's side in the artwork's own units. */
  pixelSize: number;
  /** 1 where any counted (non-erased) shape is visible, row-major RASTER_SIZE x RASTER_SIZE. */
  filled: Uint8Array;
}

function rasterizeCoverage(items: RasterItem[], bounds: Bounds, bucketCount: number): RasterResult {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const pixelSize = Math.max(w, h) / RASTER_SIZE || 1;
  const pixelCounts = new Array<number>(bucketCount).fill(0);
  const canvas = document.createElement("canvas");
  canvas.width = RASTER_SIZE;
  canvas.height = RASTER_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { pixelCounts, boundaryPixels: 0, pixelSize, filled: new Uint8Array(RASTER_SIZE * RASTER_SIZE) };

  ctx.setTransform(1 / pixelSize, 0, 0, 1 / pixelSize, -bounds.minX / pixelSize, -bounds.minY / pixelSize);
  for (const { element, index } of items) {
    const path = new Path2D();
    for (const ring of element.rings) {
      path.moveTo(ring[0][0], ring[0][1]);
      for (let i = 1; i < ring.length; i++) path.lineTo(ring[i][0], ring[i][1]);
      path.closePath();
    }
    if (index === null) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000";
    } else {
      ctx.globalCompositeOperation = "source-over";
      // Bucket index encoded in the red/green channels, offset by 1 so 0 = empty.
      const id = index + 1;
      ctx.fillStyle = `rgb(${id & 255}, ${(id >> 8) & 255}, 0)`;
    }
    ctx.fill(path, element.fillRule);
  }

  const { data } = ctx.getImageData(0, 0, RASTER_SIZE, RASTER_SIZE);
  const filled = new Uint8Array(RASTER_SIZE * RASTER_SIZE);
  for (let p = 0; p < filled.length; p++) {
    const o = p * 4;
    if (data[o + 3] < 128) continue;
    filled[p] = 1;
    // Anti-aliased edge pixels blend neighboring ids; they're a thin
    // sliver of the total, so just skip any id that doesn't decode cleanly.
    const id = data[o] + (data[o + 1] << 8) - 1;
    if (id >= 0 && id < bucketCount) pixelCounts[id]++;
  }

  let edges = 0;
  for (let y = 0; y < RASTER_SIZE; y++) {
    for (let x = 0; x < RASTER_SIZE; x++) {
      const v = filled[y * RASTER_SIZE + x];
      const right = x + 1 < RASTER_SIZE ? filled[y * RASTER_SIZE + x + 1] : 0;
      const down = y + 1 < RASTER_SIZE ? filled[(y + 1) * RASTER_SIZE + x] : 0;
      if (v !== right) edges++;
      if (v !== down) edges++;
      if (x === 0 && v) edges++;
      if (y === 0 && v) edges++;
    }
  }
  return { pixelCounts, boundaryPixels: (edges * Math.PI) / 4, pixelSize, filled };
}

/**
 * The pixel deepest inside the mask (farthest from any edge), via a two-
 * pass chamfer distance transform. Returns its center as [col, row].
 */
function deepestPixel(filled: Uint8Array): [number, number] | null {
  const n = RASTER_SIZE;
  const dist = new Float32Array(n * n);
  const big = n * 4;
  for (let i = 0; i < dist.length; i++) dist[i] = filled[i] ? big : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= n || y >= n ? 0 : dist[y * n + x]);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + Math.SQRT2, at(x + 1, y - 1) + Math.SQRT2);
    }
  }
  let best = -1;
  let bestAt: [number, number] | null = null;
  for (let y = n - 1; y >= 0; y--) {
    for (let x = n - 1; x >= 0; x--) {
      const i = y * n + x;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + Math.SQRT2, at(x - 1, y + 1) + Math.SQRT2);
      if (dist[i] > best) {
        best = dist[i];
        bestAt = [x + 0.5, y + 0.5];
      }
    }
  }
  return bestAt;
}

function layerRasterItems(prepared: PreparedContour): RasterItem[] {
  const items: RasterItem[] = [];
  prepared.layers.forEach((layer, index) => {
    for (const element of layer.elements) items.push({ element, index: layer.included ? index : null });
  });
  return items;
}

// ---------------------------------------------------------------------
// Settings -> prepared layers
// ---------------------------------------------------------------------

export interface PreparedLayer {
  elements: ArtElement[];
  included: boolean;
  height: number;
  colors: string[];
}

export interface PreparedContour {
  /** Merged runs of adjacent elements that share the same included/height settings, bottom to top. */
  layers: PreparedLayer[];
  /** Bounding box of the piece's own (included, kept) geometry. */
  bounds: Bounds;
  removedSpeckCount: number;
  /** Convex hull of the piece's own geometry (before outline margin) - the base plate's shape before its border. */
  hull: Ring;
}

interface RingInfo {
  element: number;
  ring: number;
  area: number;
  bounds: Bounds;
}

/**
 * Finds the rings of included shapes that form small pieces detached from
 * the main body (a "TM" mark, stray dots from auto-tracing) so they can be
 * dropped - each would otherwise print as its own tiny, separate chunk of
 * chocolate. Returns "elementIndex:ringIndex" keys to remove.
 */
function findSpeckRings(elements: ArtElement[], includedIdx: number[], speckPercent: number): Set<string> {
  const infos: RingInfo[] = [];
  for (const e of includedIdx) {
    elements[e].rings.forEach((ring, r) => {
      infos.push({ element: e, ring: r, area: ringArea(ring), bounds: ringBounds(ring) });
    });
  }
  if (infos.length === 0 || speckPercent <= 0) return new Set();

  const ringOf = (info: RingInfo) => elements[info.element].rings[info.ring];
  infos.sort((a, b) => b.area - a.area);

  // Parent = smallest larger ring that contains this one. Anything with a
  // parent is interior detail (a hole, or a shape sitting inside another)
  // and belongs to whatever its outermost ancestor belongs to.
  const parent = new Array<number>(infos.length).fill(-1);
  for (let i = 1; i < infos.length; i++) {
    const samples = sampleVertices(ringOf(infos[i]));
    for (let j = i - 1; j >= 0; j--) {
      if (infos[j].area <= infos[i].area) continue;
      const b = infos[j].bounds;
      if (!boundsOverlap(infos[i].bounds, b)) continue;
      const candidate = ringOf(infos[j]);
      const insideCount = samples.filter((p) => pointInRing(p, candidate)).length;
      if (insideCount * 2 > samples.length) {
        parent[i] = j;
        break;
      }
    }
  }
  const root = (i: number): number => {
    while (parent[i] !== -1) i = parent[i];
    return i;
  };

  // Top-level rings that touch or overlap form one connected piece
  // (traced art is usually several colored regions sharing edges).
  const topLevel = infos.map((_, i) => i).filter((i) => parent[i] === -1);
  const group = new Map<number, number>(topLevel.map((i) => [i, i]));
  const find = (i: number): number => {
    while (group.get(i) !== i) i = group.get(i)!;
    return i;
  };
  const artBounds = emptyBounds();
  for (const info of infos) {
    extendBounds(artBounds, [info.bounds.minX, info.bounds.minY]);
    extendBounds(artBounds, [info.bounds.maxX, info.bounds.maxY]);
  }
  const eps = Math.max(artBounds.maxX - artBounds.minX, artBounds.maxY - artBounds.minY) * 0.002;
  for (let a = 0; a < topLevel.length; a++) {
    for (let b = a + 1; b < topLevel.length; b++) {
      const ia = topLevel[a];
      const ib = topLevel[b];
      if (find(ia) === find(ib)) continue;
      if (!boundsOverlap(infos[ia].bounds, infos[ib].bounds, eps)) continue;
      // Test from the smaller ring's vertices - far fewer distance checks.
      if (ringsTouch(ringOf(infos[ib]), ringOf(infos[ia]), eps)) group.set(find(ib), find(ia));
    }
  }

  const groupArea = new Map<number, number>();
  for (const i of topLevel) groupArea.set(find(i), (groupArea.get(find(i)) ?? 0) + infos[i].area);
  const largest = Math.max(...groupArea.values());
  const threshold = largest * (speckPercent / 100);

  const removed = new Set<string>();
  infos.forEach((info, i) => {
    const g = find(root(i));
    if ((groupArea.get(g) ?? 0) < threshold) removed.add(`${info.element}:${info.ring}`);
  });
  return removed;
}

export function prepareContour(
  model: ArtworkModel,
  settings: ColorSettings,
  speckPercent: number,
  reliefDirection: "raised" | "recessed" = "raised",
): PreparedContour | null {
  // Recessed flips every color's height, so the same per-color numbers
  // become depths engraved into the base instead of raised reliefs.
  const direction = reliefDirection === "recessed" ? -1 : 1;
  const settingFor = (color: string): ColorSetting => settings[color] ?? { included: true, height: 0 };
  const includedIdx = model.elements.map((e, i) => (settingFor(e.color).included ? i : -1)).filter((i) => i !== -1);
  if (includedIdx.length === 0) return null;

  const removed = findSpeckRings(model.elements, includedIdx, speckPercent);
  const elements = model.elements.map((e, i): ArtElement => {
    if (!settingFor(e.color).included) return e;
    return { ...e, rings: e.rings.filter((_, r) => !removed.has(`${i}:${r}`)) };
  });

  const bounds = emptyBounds();
  for (const i of includedIdx) for (const ring of elements[i].rings) for (const p of ring) extendBounds(bounds, p);
  if (!Number.isFinite(bounds.minX)) return null;

  const layers: PreparedLayer[] = [];
  for (const element of elements) {
    if (element.rings.length === 0) continue;
    const { included, height } = settingFor(element.color);
    // Background painted below every included shape has nothing to mask.
    if (!included && layers.length === 0) continue;
    const effectiveHeight = included && height !== 0 ? height * direction : 0;
    const last = layers[layers.length - 1];
    if (last && last.included === included && last.height === effectiveHeight) {
      last.elements.push(element);
      if (!last.colors.includes(element.color)) last.colors.push(element.color);
    } else {
      layers.push({ elements: [element], included, height: effectiveHeight, colors: [element.color] });
    }
  }
  const hullPoints: Point[] = [];
  for (const i of includedIdx) for (const ring of elements[i].rings) hullPoints.push(...ring);

  return { layers, bounds, removedSpeckCount: removed.size, hull: convexHull(hullPoints) };
}

// ---------------------------------------------------------------------
// Prepared layers -> upload + measurements
// ---------------------------------------------------------------------

export function contourScale(prepared: PreparedContour, pieceSize: number): number {
  const { minX, minY, maxX, maxY } = prepared.bounds;
  return pieceSize / Math.max(maxX - minX, maxY - minY);
}

function formatCoord(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

export interface ContourUpload {
  files: File[];
  heights: number[];
  included: boolean[];
  artWidth: number;
  artHeight: number;
  /** Where the back label goes, in mm from the piece's center (+Y = up, matching OpenSCAD). */
  labelX: number;
  labelY: number;
}

/**
 * One SVG per prepared layer, sharing a single frame: viewBox
 * "0 0 artWidth artHeight" with the piece's bounding box at the origin.
 * Outlines are simplified to `toleranceMm` on the final piece.
 */
export function buildContourUpload(prepared: PreparedContour, pieceSize: number, toleranceMm: number): ContourUpload {
  const { minX, minY, maxX, maxY } = prepared.bounds;
  const artWidth = maxX - minX;
  const artHeight = maxY - minY;
  const tolerance = toleranceMm / contourScale(prepared, pieceSize);

  const files: File[] = [];
  const heights: number[] = [];
  const included: boolean[] = [];

  prepared.layers.forEach((layer, index) => {
    const paths = layer.elements
      .map((element) => {
        const d = element.rings
          .map((ring) => simplifyRing(ring, tolerance))
          .filter((ring) => ring.length >= 3)
          .map(
            (ring) =>
              "M" + ring.map(([x, y]) => `${formatCoord(x - minX)} ${formatCoord(y - minY)}`).join("L") + "Z",
          )
          .join("");
        return d ? `<path fill-rule="${element.fillRule}" d="${d}"/>` : "";
      })
      .filter(Boolean)
      .join("\n");
    if (!paths) return;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${formatCoord(artWidth)} ${formatCoord(artHeight)}" width="${formatCoord(artWidth)}mm" height="${formatCoord(artHeight)}mm">\n${paths}\n</svg>\n`;
    files.push(new File([svg], `layer-${index}.svg`, { type: "image/svg+xml" }));
    heights.push(layer.height);
    included.push(layer.included);
  });

  // Centered on the bounding box, a label can land in a gap (between a
  // paw's toes, say) - put it where the piece is deepest instead.
  let labelX = 0;
  let labelY = 0;
  const raster = rasterizeCoverage(layerRasterItems(prepared), prepared.bounds, prepared.layers.length);
  const deepest = deepestPixel(raster.filled);
  if (deepest) {
    const scale = contourScale(prepared, pieceSize);
    labelX = (deepest[0] * raster.pixelSize - artWidth / 2) * scale;
    labelY = -(deepest[1] * raster.pixelSize - artHeight / 2) * scale;
  }

  return { files, heights, included, artWidth, artHeight, labelX, labelY };
}

export interface ContourMeasurements {
  /** Top-view area of the whole piece, including the outline margin (mm²). */
  footprintAreaMm2: number;
  perimeterMm: number;
  /** Chocolate volume of one piece (mm³). */
  volumeMm3: number;
}

export interface BasePlate {
  /** Distance the plate extends past the design's outline (mm). */
  border: number;
  thickness: number;
}

/** A convex ring grown outward by `r`: area and perimeter (exact for round offsets of convex shapes). */
function grownConvex(areaMm2: number, perimeterMm: number, r: number): { area: number; perimeter: number } {
  return { area: areaMm2 + perimeterMm * r + Math.PI * r * r, perimeter: perimeterMm + 2 * Math.PI * r };
}

export function measureContour(
  prepared: PreparedContour,
  pieceSize: number,
  baseThickness: number,
  outlineMargin: number,
  plate: BasePlate | null = null,
): ContourMeasurements {
  const scale = contourScale(prepared, pieceSize);
  const raster = rasterizeCoverage(layerRasterItems(prepared), prepared.bounds, prepared.layers.length);
  const mmPerPixel = raster.pixelSize * scale;
  const pixelAreaMm2 = mmPerPixel * mmPerPixel;

  const silhouetteArea = raster.pixelCounts.reduce((a, b) => a + b, 0) * pixelAreaMm2;
  const silhouettePerimeter = raster.boundaryPixels * mmPerPixel;
  // offset(r) grows the area by roughly perimeter*r + πr².
  const designArea = silhouetteArea + silhouettePerimeter * outlineMargin + Math.PI * outlineMargin ** 2;

  let volumeMm3 = designArea * baseThickness;
  let footprintAreaMm2 = designArea;
  let perimeterMm = silhouettePerimeter + 2 * Math.PI * outlineMargin;
  if (plate) {
    const grown = grownConvex(
      ringArea(prepared.hull) * scale * scale,
      ringPerimeter(prepared.hull) * scale,
      outlineMargin + plate.border,
    );
    footprintAreaMm2 = grown.area;
    perimeterMm = grown.perimeter;
    volumeMm3 += grown.area * plate.thickness;
  }
  // Mirrors engrave_depth() in contour.scad: down to the plate if there is
  // one, otherwise leaving at least 0.2mm of base.
  const maxEngrave = plate ? baseThickness : Math.max(0, baseThickness - 0.2);

  prepared.layers.forEach((layer, index) => {
    if (!layer.included || layer.height === 0) return;
    const area = raster.pixelCounts[index] * pixelAreaMm2;
    volumeMm3 += layer.height > 0 ? area * layer.height : -area * Math.min(-layer.height, maxEngrave);
  });

  return { footprintAreaMm2, perimeterMm, volumeMm3: Math.max(0, volumeMm3) };
}
