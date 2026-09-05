import { useId } from "react";
import type { SvgNaturalSize } from "../../utils/svg";

interface TokenLayoutPreviewProps {
  tokenShape: string;
  tokenSize: number;
  tokenLength: number;
  cornerRadius: number;
  borderStyle: string;
  borderInset: number;
  svgUrl: string;
  svgNaturalSize: SvgNaturalSize;
  svgScale: number;
}

interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

function TokenOutline({
  tokenShape,
  halfWidth,
  halfHeight,
  cornerRadius,
  ...rest
}: {
  tokenShape: string;
  halfWidth: number;
  halfHeight: number;
  cornerRadius: number;
} & ShapeStyle) {
  if (tokenShape === "circle" || tokenShape === "oval") {
    return <ellipse cx={0} cy={0} rx={halfWidth} ry={halfHeight} {...rest} />;
  }
  const r = Math.max(0, Math.min(cornerRadius, halfWidth, halfHeight));
  return <rect x={-halfWidth} y={-halfHeight} width={halfWidth * 2} height={halfHeight * 2} rx={r} ry={r} {...rest} />;
}

/**
 * A purely client-side, instant approximation of the token layout - no
 * OpenSCAD round trip. It exists so uploading a graphic (or nudging a
 * slider) gives immediate visual feedback on fit, while the real 3D
 * compile stays behind the explicit Generate button where its latency is
 * expected rather than surprising.
 */
// Fixed to the token_size/token_length schema max (150mm, see
// paramSchemas.ts) rather than derived from the current token dimensions -
// otherwise the view would auto-zoom to fit whatever size is selected, and
// a 30mm and a 65mm token would always render at the same on-screen size,
// hiding the actual scale difference between size presets.
const FIXED_VIEW_HALF = 90;

export function TokenLayoutPreview({
  tokenShape,
  tokenSize,
  tokenLength,
  cornerRadius,
  borderStyle,
  borderInset,
  svgUrl,
  svgNaturalSize,
  svgScale,
}: TokenLayoutPreviewProps) {
  const clipId = useId();
  const effLength = tokenShape === "oval" || tokenShape === "rectangle" ? tokenLength : tokenSize;
  const halfWidth = tokenSize / 2;
  const halfHeight = effLength / 2;
  const viewHalf = FIXED_VIEW_HALF;

  const imgWidth = svgNaturalSize.width * svgScale;
  const imgHeight = svgNaturalSize.height * svgScale;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6">
      <svg
        viewBox={`${-viewHalf} ${-viewHalf} ${viewHalf * 2} ${viewHalf * 2}`}
        className="max-h-full max-w-full drop-shadow-lg"
        style={{ width: "min(70%, 60vh)" }}
      >
        <defs>
          <clipPath id={clipId}>
            <TokenOutline tokenShape={tokenShape} halfWidth={halfWidth} halfHeight={halfHeight} cornerRadius={cornerRadius} />
          </clipPath>
        </defs>

        <TokenOutline
          tokenShape={tokenShape}
          halfWidth={halfWidth}
          halfHeight={halfHeight}
          cornerRadius={cornerRadius}
          fill="#d9b98c"
          stroke="#6f3c22"
          strokeWidth={viewHalf * 0.015}
        />

        <g clipPath={`url(#${clipId})`}>
          <image href={svgUrl} x={-imgWidth / 2} y={-imgHeight / 2} width={imgWidth} height={imgHeight} />
        </g>

        {borderStyle !== "none" && (
          <TokenOutline
            tokenShape={tokenShape}
            halfWidth={Math.max(0, halfWidth - borderInset)}
            halfHeight={Math.max(0, halfHeight - borderInset)}
            cornerRadius={cornerRadius}
            fill="none"
            stroke="#4a2a1c"
            strokeWidth={viewHalf * 0.02}
            strokeDasharray={borderStyle === "beaded" ? `${viewHalf * 0.03} ${viewHalf * 0.03}` : undefined}
          />
        )}
      </svg>
      <p className="text-center text-xs text-cocoa-400">
        Layout preview (instant, approximate) — click Generate / Preview for the real 3D render
      </p>
    </div>
  );
}
