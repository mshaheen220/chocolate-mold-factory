import { FILAMENT_RECOMMENDATION, NOZZLE_RECOMMENDATION, POST_PROCESSING_STEPS, SLICER_SETTINGS, type SlicerSetting } from "../printRecommendations";
import { exportPrintRecommendationsAsJson, exportPrintRecommendationsAsText } from "../utils/exportRecommendations";

function SettingRow({ setting, value, why }: SlicerSetting) {
  return (
    <div>
      <span className="text-xs font-medium text-cocoa-200">{setting}</span>
      <div className="text-sm font-semibold text-cocoa-50">{value}</div>
      <p className="mt-0.5 text-[11px] leading-snug text-cocoa-400">{why}</p>
    </div>
  );
}

/**
 * A static reference sheet (not tied to the current token's params) so
 * users can check recommended print settings without hunting through the
 * rotating tips. The export buttons save the same content to a file to
 * keep alongside a downloaded STL for whenever printing actually happens.
 */
export function PrintReferenceCard() {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <SettingRow {...NOZZLE_RECOMMENDATION} />
        <SettingRow {...FILAMENT_RECOMMENDATION} />
      </div>

      <div className="space-y-3 border-t border-cocoa-800 pt-3">
        {SLICER_SETTINGS.map((s) => (
          <SettingRow key={s.setting} {...s} />
        ))}
      </div>

      <div className="border-t border-cocoa-800 pt-3">
        <p className="mb-1.5 text-xs font-medium text-cocoa-200">After Printing</p>
        <ul className="space-y-1.5 text-[11px] leading-snug text-cocoa-400">
          {POST_PROCESSING_STEPS.map((step) => (
            <li key={step} className="flex gap-1.5">
              <span className="text-cocoa-600">&bull;</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2 border-t border-cocoa-800 pt-3">
        <button
          type="button"
          onClick={exportPrintRecommendationsAsText}
          className="flex-1 rounded-md border border-cocoa-700 px-2 py-1.5 text-xs font-medium text-cocoa-200 transition-colors hover:bg-cocoa-800"
        >
          Export .txt
        </button>
        <button
          type="button"
          onClick={exportPrintRecommendationsAsJson}
          className="flex-1 rounded-md border border-cocoa-700 px-2 py-1.5 text-xs font-medium text-cocoa-200 transition-colors hover:bg-cocoa-800"
        >
          Export .json
        </button>
      </div>
    </div>
  );
}
