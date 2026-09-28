import { useId, useMemo } from "react";
import { type BasePlate, contourScale, type PreparedContour, type Ring } from "../../utils/contour";

interface ContourLayoutPreviewProps {
  prepared: PreparedContour | null;
  pieceSize: number;
  outlineMargin: number;
  plate: BasePlate | null;
  emptyMessage: string;
}

// Same fixed view as TokenLayoutPreview, so switching between a coin and a
// contoured piece keeps a consistent on-screen scale.
const FIXED_VIEW_HALF = 90;

// Chocolate shades: engraved areas read darker, raised areas lighter.
const BASE_SHADE: [number, number, number] = [176, 122, 79];
const HIGH_SHADE: [number, number, number] = [235, 200, 150];
const LOW_SHADE: [number, number, number] = [96, 54, 30];

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function ringsToPath(rings: Ring[]): string {
  return rings.map((ring) => "M" + ring.map(([x, y]) => `${x} ${y}`).join("L") + "Z").join("");
}

/**
 * Instant, client-side approximation of a contoured piece: the included
 * colors shaded by height, masked by any background color painted over
 * them, on top of the outline margin drawn as a round-joined stroke (which
 * grows the shape by the same distance offset(r) does).
 */
export function ContourLayoutPreview({
  prepared,
  pieceSize,
  outlineMargin,
  plate,
  emptyMessage,
}: ContourLayoutPreviewProps) {
  const maskId = useId();
  const layerPaths = useMemo(
    () =>
      prepared?.layers.map((layer) =>
        layer.elements.map((element) => ({ d: ringsToPath(element.rings), fillRule: element.fillRule })),
      ) ?? [],
    [prepared],
  );

  if (!prepared) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-cocoa-400">{emptyMessage}</p>
      </div>
    );
  }

  const scale = contourScale(prepared, pieceSize);
  const { minX, minY, maxX, maxY } = prepared.bounds;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const heights = prepared.layers.filter((l) => l.included).map((l) => l.height);
  const maxHeight = Math.max(0, ...heights);
  const minHeight = Math.min(0, ...heights);
  const shadeFor = (height: number) =>
    height >= 0
      ? mix(BASE_SHADE, HIGH_SHADE, maxHeight > 0 ? height / maxHeight : 0)
      : mix(BASE_SHADE, LOW_SHADE, minHeight < 0 ? height / minHeight : 0);
  const transform = `scale(${scale}) translate(${-centerX} ${-centerY})`;
  // The plate sits a tier below the design, so it reads darker.
  const plateShade = mix(BASE_SHADE, LOW_SHADE, 0.45);
  const plateGrowth = plate ? outlineMargin + plate.border : outlineMargin;
  let spanX = maxX - minX;
  let spanY = maxY - minY;
  if (plate) {
    const xs = prepared.hull.map((p) => p[0]);
    const ys = prepared.hull.map((p) => p[1]);
    spanX = Math.max(...xs) - Math.min(...xs);
    spanY = Math.max(...ys) - Math.min(...ys);
  }
  const widthMm = spanX * scale + 2 * plateGrowth;
  const heightMm = spanY * scale + 2 * plateGrowth;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6">
      <svg
        viewBox={`${-FIXED_VIEW_HALF} ${-FIXED_VIEW_HALF} ${FIXED_VIEW_HALF * 2} ${FIXED_VIEW_HALF * 2}`}
        className="max-h-full max-w-full drop-shadow-lg"
        style={{ width: "min(70%, 60vh)" }}
        role="img"
        aria-label={`Contoured piece preview, ${widthMm.toFixed(1)} by ${heightMm.toFixed(1)} millimeters`}
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x={-FIXED_VIEW_HALF} y={-FIXED_VIEW_HALF} width={FIXED_VIEW_HALF * 2} height={FIXED_VIEW_HALF * 2}>
            <g transform={transform}>
              {prepared.layers.map((layer, i) =>
                layerPaths[i].map((p, j) => (
                  <path key={`mask-${i}-${j}`} d={p.d} fillRule={p.fillRule} fill={layer.included ? "white" : "black"} />
                )),
              )}
            </g>
          </mask>
        </defs>
        {plate && (
          <g transform={transform}>
            <path
              d={ringsToPath([prepared.hull])}
              fill={plateShade}
              stroke={plateShade}
              strokeWidth={(2 * plateGrowth) / scale}
              strokeLinejoin="round"
            />
          </g>
        )}
        {outlineMargin > 0 && (
          <g transform={transform}>
            {prepared.layers.map((layer, i) =>
              layer.included
                ? layerPaths[i].map((p, j) => (
                    <path
                      key={`margin-${i}-${j}`}
                      d={p.d}
                      fillRule={p.fillRule}
                      fill={shadeFor(0)}
                      stroke={shadeFor(0)}
                      strokeWidth={(2 * outlineMargin) / scale}
                      strokeLinejoin="round"
                    />
                  ))
                : null,
            )}
          </g>
        )}
        <g mask={`url(#${maskId})`}>
          <g transform={transform}>
            {prepared.layers.map((layer, i) =>
              layer.included
                ? layerPaths[i].map((p, j) => (
                    <path key={`layer-${i}-${j}`} d={p.d} fillRule={p.fillRule} fill={shadeFor(layer.height)} />
                  ))
                : null,
            )}
          </g>
        </g>
      </svg>
      <p className="text-center text-xs text-cocoa-400">
        {widthMm.toFixed(1)} × {heightMm.toFixed(1)} mm · {plate ? "plate included · " : ""}lighter = taller. Layout preview (instant, approximate) —
        click Generate / Preview for the real 3D render
      </p>
    </div>
  );
}
