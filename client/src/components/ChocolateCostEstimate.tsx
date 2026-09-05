import { isGridMode } from "../paramSchemas";
import type { ParamValues } from "../types";
import type { SvgNaturalSize } from "../utils/svg";
import { computeTokenVolume } from "../utils/volume";

const CHOCOLATE_DENSITY_G_PER_ML = 1.3; // reasonable single estimate across chocolate types
const G_PER_OZ = 28.3495;

const CHOCOLATE_PRICES_PER_OZ: { id: string; label: string; pricePerOz: number }[] = [
  { id: "milk", label: "Milk", pricePerOz: 0.34 },
  { id: "dark", label: "Dark", pricePerOz: 0.41 },
  { id: "white", label: "White", pricePerOz: 0.42 },
  { id: "colored", label: "Colored", pricePerOz: 0.45 },
];

interface ChocolateCostEstimateProps {
  params: ParamValues;
  svgNaturalSize: SvgNaturalSize | null;
  svgFillRatio: number | null;
}

export function ChocolateCostEstimate({ params, svgNaturalSize, svgFillRatio }: ChocolateCostEstimateProps) {
  const { totalVolumeMm3 } = computeTokenVolume(params, svgNaturalSize, svgFillRatio);
  const volumeMl = totalVolumeMm3 / 1000;
  const weightG = volumeMl * CHOCOLATE_DENSITY_G_PER_ML;
  const weightOz = weightG / G_PER_OZ;

  const tokenCount = isGridMode(params) ? Math.max(1, Math.round(Number(params.grid_x) * Number(params.grid_y))) : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-cocoa-300">Volume per coin</span>
        <span className="font-medium tabular-nums text-cocoa-100">
          {volumeMl.toFixed(2)} mL &middot; {weightG.toFixed(1)} g
        </span>
      </div>

      <div className="space-y-1.5">
        {CHOCOLATE_PRICES_PER_OZ.map(({ id, label, pricePerOz }) => {
          const perCoin = weightOz * pricePerOz;
          return (
            <div key={id} className="flex items-center justify-between text-xs">
              <span className="text-cocoa-300">{label}</span>
              <span className="tabular-nums text-cocoa-100">
                ${perCoin.toFixed(3)}
                {tokenCount > 1 && (
                  <span className="ml-1.5 text-cocoa-400">/ ${(perCoin * tokenCount).toFixed(2)} for {tokenCount}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] leading-tight text-cocoa-500">
        Estimate assumes {CHOCOLATE_DENSITY_G_PER_ML} g/mL chocolate density
        {svgFillRatio !== null ? " and the uploaded graphic's measured ink coverage" : ""}. Actual usage varies with
        pour technique and mold overflow.
      </p>
    </div>
  );
}
