import { type ArtworkModel, type ColorSetting, type ColorSettings, GRADIENT_COLOR_KEY } from "../utils/contour";
import { NumberField } from "./controls/NumberField";

const MIN_LAYER_HEIGHT = -5;
const MAX_LAYER_HEIGHT = 5;

interface ColorLayersPanelProps {
  artwork: ArtworkModel | null;
  analysisError: string | null;
  colorSettings: ColorSettings;
  onChange: (color: string, setting: ColorSetting) => void;
  removedSpeckCount: number;
  /** Relief Direction = Recessed: heights read as depths into the base. */
  recessed: boolean;
}

export function ColorLayersPanel({
  artwork,
  analysisError,
  colorSettings,
  onChange,
  removedSpeckCount,
  recessed,
}: ColorLayersPanelProps) {
  if (analysisError) {
    return <p className="text-xs text-red-400">{analysisError}</p>;
  }
  if (!artwork) {
    return <p className="text-xs text-cocoa-400">Upload an SVG to pick which colors form the piece and how tall each one is.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {artwork.colors.map(({ key, coverage }) => {
          const setting = colorSettings[key] ?? { included: true, height: 0 };
          const swatchId = `color-layer-${key.replace("#", "")}`;
          return (
            <li key={key} className="space-y-2 rounded-md border border-cocoa-800 bg-cocoa-900/40 p-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-5 w-5 shrink-0 rounded border border-cocoa-600"
                  style={{
                    background:
                      key === GRADIENT_COLOR_KEY ? "linear-gradient(135deg, #bbb, #555)" : key,
                  }}
                  aria-hidden="true"
                />
                <span id={swatchId} className="flex-1 font-mono text-xs text-cocoa-200">
                  {key === GRADIENT_COLOR_KEY ? "Gradient fills" : key}
                  <span className="ml-1.5 font-sans text-[10px] text-cocoa-500">{(coverage * 100).toFixed(1)}%</span>
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-cocoa-300">
                  <input
                    type="checkbox"
                    checked={setting.included}
                    onChange={(e) => onChange(key, { ...setting, included: e.target.checked })}
                    aria-describedby={swatchId}
                    className="h-4 w-4 rounded border-cocoa-600 bg-cocoa-900 accent-cocoa-400"
                  />
                  In piece
                </label>
              </div>
              {setting.included ? (
                <NumberField
                  label={recessed ? "Depth into base" : "Height above base"}
                  value={setting.height}
                  min={MIN_LAYER_HEIGHT}
                  max={MAX_LAYER_HEIGHT}
                  step={0.1}
                  unit="mm"
                  onChange={(height) => onChange(key, { ...setting, height })}
                />
              ) : (
                <p className="text-[10px] text-cocoa-500">Background — cut away wherever it's painted.</p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-cocoa-400">
        The piece's outline is the combined shape of every color marked “In piece”. Each color is then{" "}
        {recessed
          ? "engraved that many mm into the base (0 = flush, negative = raised instead). Engraving always leaves at least 0.2mm of base (above the back label, if any) so it can't cut through."
          : "raised that many mm above the base (0 = flush, negative = engraved instead)."}
      </p>
      {removedSpeckCount > 0 && (
        <p className="text-xs text-cocoa-400">
          Removed {removedSpeckCount} small detached {removedSpeckCount === 1 ? "shape" : "shapes"} (e.g. a ™ mark)
          that would otherwise print as separate crumbs.
        </p>
      )}
      {artwork.skippedCount > 0 && (
        <p className="text-xs text-amber-400">
          Ignored {artwork.skippedCount} element{artwork.skippedCount === 1 ? "" : "s"} this tool can't convert
          (text, images, or &lt;use&gt; references) — convert text to outlines in your editor to include it.
        </p>
      )}
    </div>
  );
}
