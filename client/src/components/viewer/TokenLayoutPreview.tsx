import { useId } from "react";
import type { SvgNaturalSize } from "../../utils/svg";

interface TokenLayoutPreviewProps {
  tokenSize: number;
  borderStyle: string;
  borderDirection: string;
  borderInset: number;
  svgUrl: string | null;
  svgNaturalSize: SvgNaturalSize | null;
  svgScale: number;
  svgOffsetX: number;
  svgOffsetY: number;
}

interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeDasharray?: string;
}

function TokenOutline({ radius, ...rest }: { radius: number } & ShapeStyle) {
  return <circle cx={0} cy={0} r={radius} {...rest} />;
}

/**
 * A purely client-side, instant approximation of the coin layout - no
 * OpenSCAD round trip. It exists so uploading a graphic (or nudging a
 * slider) gives immediate visual feedback on fit, while the real 3D
 * compile stays behind the explicit Generate button where its latency is
 * expected rather than surprising.
 */
// Fixed to the token_size schema max (150mm, see paramSchemas.ts) rather
// than derived from the current coin size - otherwise the view would
// auto-zoom to fit whatever size is selected, and a 30mm and a 65mm coin
// would always render at the same on-screen size, hiding the actual scale
// difference between size presets.
const FIXED_VIEW_HALF = 90;

export function TokenLayoutPreview({
  tokenSize,
  borderStyle,
  borderDirection,
  borderInset,
  svgUrl,
  svgNaturalSize,
  svgScale,
  svgOffsetX,
  svgOffsetY,
}: TokenLayoutPreviewProps) {
  const clipId = useId();
  const radius = tokenSize / 2;
  const viewHalf = FIXED_VIEW_HALF;

  const hasImage = svgUrl && svgNaturalSize;
  const imgWidth = hasImage ? svgNaturalSize.width * svgScale : 0;
  const imgHeight = hasImage ? svgNaturalSize.height * svgScale : 0;
  // SVG y grows downward but svg_offset_y (matching the OpenSCAD template)
  // is "+Y = up", so it's subtracted here rather than added.
  const imgX = -imgWidth / 2 + svgOffsetX;
  const imgY = -imgHeight / 2 - svgOffsetY;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6">
      <svg
        viewBox={`${-viewHalf} ${-viewHalf} ${viewHalf * 2} ${viewHalf * 2}`}
        className="max-h-full max-w-full drop-shadow-lg"
        style={{ width: "min(70%, 60vh)" }}
      >
        <defs>
          <clipPath id={clipId}>
            <TokenOutline radius={radius} />
          </clipPath>
        </defs>

        <TokenOutline radius={radius} fill="#d9b98c" stroke="#6f3c22" strokeWidth={viewHalf * 0.015} />

        {hasImage && (
          <g clipPath={`url(#${clipId})`}>
            <image href={svgUrl} x={imgX} y={imgY} width={imgWidth} height={imgHeight} />
          </g>
        )}

        {borderStyle !== "none" && (
          <TokenOutline
            radius={Math.max(0, radius - borderInset)}
            fill="none"
            // Raised catches light (bright highlight); recessed reads as a
            // shadowed groove (dark, slightly heavier stroke) - a rough
            // but immediate visual cue for which direction is selected.
            stroke={borderDirection === "recessed" ? "#2c1a12" : "#f3dfb8"}
            strokeWidth={viewHalf * (borderDirection === "recessed" ? 0.024 : 0.02)}
            strokeOpacity={borderDirection === "recessed" ? 0.85 : 1}
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
