import { FILAMENT_RECOMMENDATION, NOZZLE_RECOMMENDATION, POST_PROCESSING_STEPS, SLICER_SETTINGS } from "../printRecommendations";

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportPrintRecommendationsAsJson(): void {
  const payload = {
    generatedBy: "Chocolate Mold Factory",
    exportedAt: new Date().toISOString(),
    nozzle: NOZZLE_RECOMMENDATION,
    filament: FILAMENT_RECOMMENDATION,
    slicerSettings: SLICER_SETTINGS,
    postProcessing: POST_PROCESSING_STEPS,
  };
  downloadTextFile("chocolate-mold-print-settings.json", JSON.stringify(payload, null, 2), "application/json");
}

export function exportPrintRecommendationsAsText(): void {
  // Each setting as its own block (name: value, then an indented "why"
  // line) rather than a fixed-width table - "why" is a full sentence, so
  // a padded-column table breaks alignment the moment one value is long.
  const settingBlock = (s: (typeof SLICER_SETTINGS)[number]) => `${s.setting}: ${s.value}\n  ${s.why}`;

  const lines = [
    "CHOCOLATE MOLD FACTORY - PRINT & SLICER REFERENCE",
    `Exported ${new Date().toLocaleString()}`,
    "",
    settingBlock(NOZZLE_RECOMMENDATION),
    "",
    settingBlock(FILAMENT_RECOMMENDATION),
    "",
    "SLICER SETTINGS",
    ...SLICER_SETTINGS.flatMap((s) => [settingBlock(s), ""]),
    "AFTER PRINTING",
    ...POST_PROCESSING_STEPS.map((step) => `  - ${step}`),
    "",
  ];

  downloadTextFile("chocolate-mold-print-settings.txt", lines.join("\n"), "text/plain");
}
