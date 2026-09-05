import { getActiveTokenPreset, TOKEN_PRESETS, type TokenPreset } from "../../paramSchemas";
import type { ParamValues } from "../../types";
import type { SvgNaturalSize } from "../../utils/svg";

interface TokenSizePresetsProps {
  params: ParamValues;
  svgNaturalSize: SvgNaturalSize | null;
  onSelect: (preset: TokenPreset) => void;
}

export function TokenSizePresets({ params, svgNaturalSize, onSelect }: TokenSizePresetsProps) {
  const active = getActiveTokenPreset(params, svgNaturalSize);

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-cocoa-200">Size Preset</span>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {Object.values(TOKEN_PRESETS).map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            className={`rounded-md border px-2 py-1.5 text-left transition-colors ${
              active === preset.id
                ? "border-cocoa-400 bg-cocoa-700/60 text-cocoa-50"
                : "border-cocoa-700 bg-cocoa-900/40 text-cocoa-300 hover:border-cocoa-500"
            }`}
          >
            <div className="text-xs font-semibold">{preset.label}</div>
            <div className="text-[10px] leading-tight text-cocoa-400">{preset.sublabel}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
