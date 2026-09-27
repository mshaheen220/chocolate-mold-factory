import { CHOCOLATE_PRICES_PER_OZ, FILAMENT_MATERIALS } from "../pricing";
import type { ParamValues } from "../types";
import type { SvgNaturalSize } from "../utils/svg";
import { computeTokenVolume, estimateFilamentVolumeMm3 } from "../utils/volume";

const CHOCOLATE_DENSITY_G_PER_ML = 1.3; // reasonable single estimate across chocolate types
const G_PER_OZ = 28.3495;

interface CostEstimateProps {
  params: ParamValues;
  svgNaturalSize: SvgNaturalSize | null;
  svgFillRatio: number | null;
}

export function CostEstimate({ params, svgNaturalSize, svgFillRatio }: CostEstimateProps) {
  const { totalVolumeMm3 } = computeTokenVolume(params, svgNaturalSize, svgFillRatio);
  const volumeMl = totalVolumeMm3 / 1000;
  const weightG = volumeMl * CHOCOLATE_DENSITY_G_PER_ML;
  const weightOz = weightG / G_PER_OZ;

  const filamentVolumeMl = estimateFilamentVolumeMm3(params, totalVolumeMm3) / 1000;

  const milk = CHOCOLATE_PRICES_PER_OZ.find((c) => c.id === "milk");
  const milkCostPerCoin = milk ? weightOz * milk.pricePerOz : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-cocoa-700 bg-cocoa-800/40 px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-cocoa-200">Chocolate cost per coin (Milk)</span>
          <span className="text-sm font-semibold text-cocoa-50">${milkCostPerCoin.toFixed(3)}</span>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-cocoa-300">Chocolate volume per coin</span>
          <span className="font-medium tabular-nums text-cocoa-100">
            {volumeMl.toFixed(2)} mL &middot; {weightG.toFixed(1)} g
          </span>
        </div>

        <div className="mt-1.5 space-y-1.5">
          {CHOCOLATE_PRICES_PER_OZ.map(({ id, label, pricePerOz }) => {
            const perCoin = weightOz * pricePerOz;
            return (
              <div key={id} className="flex items-center justify-between text-xs">
                <span className="text-cocoa-300">{label}</span>
                <span className="tabular-nums text-cocoa-100">${perCoin.toFixed(3)}</span>
              </div>
            );
          })}
        </div>

        <p className="mt-1.5 text-[10px] leading-tight text-cocoa-500">
          Assumes {CHOCOLATE_DENSITY_G_PER_ML} g/mL chocolate density
          {svgFillRatio !== null ? " and the uploaded graphic's measured ink coverage" : ""}. Actual usage varies
          with pour technique and mold overflow.
        </p>
      </div>

      <div className="border-t border-cocoa-800 pt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-cocoa-300">Filament to print master</span>
          <span className="font-medium tabular-nums text-cocoa-100">{filamentVolumeMl.toFixed(2)} mL</span>
        </div>

        <div className="mt-1.5 space-y-1.5">
          {FILAMENT_MATERIALS.map(({ id, label, densityGPerCm3, pricePerKg }) => {
            const weightGForMaterial = filamentVolumeMl * densityGPerCm3;
            const cost = (weightGForMaterial / 1000) * pricePerKg;
            return (
              <div key={id} className="flex items-center justify-between text-xs">
                <span className="text-cocoa-300">{label}</span>
                <span className="tabular-nums text-cocoa-100">
                  {weightGForMaterial.toFixed(1)} g &middot; ${cost.toFixed(3)}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-1.5 text-[10px] leading-tight text-cocoa-500">
          One-time cost to print the master, not per coin - the same printed master is reused for every mold you pour
          from it. Estimates solid outer walls/top/bottom shell at full density (matching Print & Slicer Reference)
          and the remaining interior at 4% infill - not the raw model volume, which would overstate usage.
        </p>
      </div>
    </div>
  );
}
