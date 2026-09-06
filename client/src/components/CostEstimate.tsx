import { isGridMode } from "../paramSchemas";
import { CHOCOLATE_PRICES_PER_OZ, SILICONE_MATERIALS, FILAMENT_MATERIALS } from "../pricing";
import type { ParamValues } from "../types";
import type { SvgNaturalSize } from "../utils/svg";
import { computeTokenVolume, estimateFilamentVolumeMm3, estimateSiliconePourVolumeMm3 } from "../utils/volume";

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
  const siliconeVolumeMl = estimateSiliconePourVolumeMm3(params, totalVolumeMm3) / 1000;

  const tokenCount = isGridMode(params) ? Math.max(1, Math.round(Number(params.grid_x) * Number(params.grid_y))) : 1;

  // Headline number: chocolate is the only cost here that's genuinely
  // "per coin" - it's consumed fresh on every pour. Filament and silicone
  // are one-time setup costs (print the master once, pour the mold once,
  // then reuse it for many batches), so they're shown as their own
  // one-time figures below rather than folded into a per-coin number.
  const milk = CHOCOLATE_PRICES_PER_OZ.find((c) => c.id === "milk");
  const milkCostPerCoin = milk ? weightOz * milk.pricePerOz : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-cocoa-700 bg-cocoa-800/40 px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-cocoa-200">Chocolate cost per coin (Milk)</span>
          <span className="text-sm font-semibold text-cocoa-50">${milkCostPerCoin.toFixed(3)}</span>
        </div>
        {tokenCount > 1 && (
          <div className="mt-0.5 flex items-baseline justify-between text-[11px] text-cocoa-400">
            <span>For {tokenCount} coins</span>
            <span className="tabular-nums">${(milkCostPerCoin * tokenCount).toFixed(2)}</span>
          </div>
        )}
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
                <span className="tabular-nums text-cocoa-100">
                  ${perCoin.toFixed(3)}
                  {tokenCount > 1 && (
                    <span className="ml-1.5 text-cocoa-400">
                      / ${(perCoin * tokenCount).toFixed(2)} for {tokenCount}
                    </span>
                  )}
                </span>
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
          and the remaining interior at 30% infill - not the raw model volume, which would overstate usage. Per token
          relief only; doesn't include the surrounding mold box or frame structure.
        </p>
      </div>

      {siliconeVolumeMl > 0 && (
        <div className="border-t border-cocoa-800 pt-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-cocoa-300">Silicone to make this mold</span>
            <span className="font-medium tabular-nums text-cocoa-100">{siliconeVolumeMl.toFixed(1)} mL</span>
          </div>

          <div className="mt-1.5 space-y-1.5">
            {SILICONE_MATERIALS.map(({ id, label, densityGPerCm3, pricePerMl }) => (
              <div key={id} className="flex items-center justify-between text-xs">
                <span className="text-cocoa-300">{label}</span>
                <span className="tabular-nums text-cocoa-100">
                  {(siliconeVolumeMl * densityGPerCm3).toFixed(0)} g &middot; ${(siliconeVolumeMl * pricePerMl).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-1.5 text-[10px] leading-tight text-cocoa-500">
            One-time cost to pour this mold, not per coin - the cured silicone then casts many chocolates on its own.
            Cavity volume minus the space the token grid itself displaces.
          </p>
        </div>
      )}
    </div>
  );
}
