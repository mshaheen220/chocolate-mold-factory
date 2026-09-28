import { isFieldVisible, pieceModeOf, type TokenPreset } from "../paramSchemas";
import type { Field, ParamValues } from "../types";
import type { ArtworkModel, ColorSetting, ColorSettings } from "../utils/contour";
import type { SvgNaturalSize } from "../utils/svg";
import type { Footprint } from "../utils/volume";
import { ColorLayersPanel } from "./ColorLayersPanel";
import { CostEstimate } from "./CostEstimate";
import { ParameterCard } from "./ParameterCard";
import { PrintReferenceCard } from "./PrintReferenceCard";
import { FieldRenderer } from "./FieldRenderer";
import { NumberField } from "./controls/NumberField";
import { FileDropzone } from "./controls/FileDropzone";
import { TokenSizePresets } from "./controls/TokenSizePresets";

// Matches the server's DEFAULT_FINAL_FACET_COUNT / MIN_FACET_COUNT /
// MAX_FACET_COUNT (server/src/lib/validation.ts) - Quick Preview always
// uses a small fixed facet count regardless of this setting, so it only
// affects Full Render.
const MIN_RENDER_DETAIL = 16;
const MAX_RENDER_DETAIL = 180;

// Generous FDM range (0.04mm fine-detail resins/nozzles up to 0.4mm fat
// nozzles) rather than anything tied to a specific printer.
const MIN_LAYER_HEIGHT = 0.04;
const MAX_LAYER_HEIGHT = 0.4;
const MAX_FIRST_LAYER_HEIGHT = 0.6;

interface SidebarProps {
  fields: Field[];
  params: ParamValues;
  onChange: (key: string, value: Field["default"]) => void;
  svgFile: File | null;
  svgPreviewUrl: string | null;
  svgNaturalSize: SvgNaturalSize | null;
  artwork: ArtworkModel | null;
  artworkError: string | null;
  colorSettings: ColorSettings;
  onColorSettingChange: (color: string, setting: ColorSetting) => void;
  removedSpeckCount: number;
  estimate: { totalVolumeMm3: number; footprint: Footprint; measuredArtwork: boolean };
  onSvgFile: (file: File | null) => void;
  onSelectPreset: (preset: TokenPreset) => void;
  renderDetail: number;
  onRenderDetailChange: (value: number) => void;
  layerHeight: number;
  onLayerHeightChange: (value: number) => void;
  firstLayerHeight: number;
  onFirstLayerHeightChange: (value: number) => void;
  onNormalize: () => void;
}

const GROUP_CARDS: { group: Field["group"]; title: string }[] = [
  { group: "geometry", title: "Geometry & Sizing" },
  { group: "layers", title: "Color Layers" },
  { group: "border", title: "Border" },
  { group: "label", title: "Back Label" },
];

export function Sidebar({
  fields,
  params,
  onChange,
  svgFile,
  svgPreviewUrl,
  svgNaturalSize,
  artwork,
  artworkError,
  colorSettings,
  onColorSettingChange,
  removedSpeckCount,
  estimate,
  onSvgFile,
  onSelectPreset,
  renderDetail,
  onRenderDetailChange,
  layerHeight,
  onLayerHeightChange,
  firstLayerHeight,
  onFirstLayerHeightChange,
  onNormalize,
}: SidebarProps) {
  const mode = pieceModeOf(params);

  return (
    <div className="flex flex-col gap-4">
      <ParameterCard title="Asset Upload">
        <FileDropzone
          accept=".svg"
          label="Graphic (SVG)"
          file={svgFile}
          previewUrl={svgPreviewUrl}
          onFile={onSvgFile}
        />
        <p className="text-xs text-cocoa-400">
          {mode === "contour"
            ? "Required — the piece's outline is traced from this graphic's filled shapes, one layer per color."
            : "Optional — without a graphic, the coin base shape alone is generated."}
        </p>
      </ParameterCard>

      {GROUP_CARDS.map(({ group, title }) => {
        const groupFields = fields.filter((f) => f.group === group);
        if (groupFields.length === 0) return null;

        const hasVisibleField = groupFields.some((f) => isFieldVisible(f, params));
        // The primary "Geometry & Sizing" card always shows (it holds the
        // size presets); the "Border" card hides entirely when nothing in
        // it currently applies.
        if (!hasVisibleField && group !== "geometry") return null;

        return (
          <ParameterCard key={group} title={title}>
            {group === "geometry" && mode === "coin" && (
              <TokenSizePresets params={params} svgNaturalSize={svgNaturalSize} onSelect={onSelectPreset} />
            )}
            {group === "layers" && (
              <ColorLayersPanel
                artwork={artwork}
                analysisError={artworkError}
                colorSettings={colorSettings}
                onChange={onColorSettingChange}
                removedSpeckCount={removedSpeckCount}
                recessed={params.contour_relief_direction === "recessed"}
              />
            )}
            {groupFields.map((field) => (
              <FieldRenderer key={field.key} field={field} params={params} onChange={onChange} />
            ))}
            {group === "label" && (
              <p className="text-xs text-cocoa-400">
                Etched as a shallow recess into the back (bed-facing) side, so printed pieces with different
                settings can be told apart. Leave blank to skip it.
              </p>
            )}
          </ParameterCard>
        );
      })}

      <ParameterCard title="Render Detail" defaultOpen={false}>
        <NumberField
          label="Facet Count ($fn)"
          value={renderDetail}
          min={MIN_RENDER_DETAIL}
          max={MAX_RENDER_DETAIL}
          step={2}
          onChange={onRenderDetailChange}
        />
        <p className="text-xs text-cocoa-400">
          Curve smoothness for Full Render — higher is smoother but slower. Quick Preview always uses a fast fixed
          value regardless of this setting.
        </p>
      </ParameterCard>

      <ParameterCard title="Normalize to Layers" defaultOpen={false}>
        <NumberField
          label="Layer Height"
          value={layerHeight}
          min={MIN_LAYER_HEIGHT}
          max={MAX_LAYER_HEIGHT}
          step={0.01}
          unit="mm"
          onChange={onLayerHeightChange}
        />
        <NumberField
          label="First Layer Height"
          value={firstLayerHeight}
          min={MIN_LAYER_HEIGHT}
          max={MAX_FIRST_LAYER_HEIGHT}
          step={0.01}
          unit="mm"
          onChange={onFirstLayerHeightChange}
        />
        <p className="text-xs text-cocoa-400">
          {mode === "contour"
            ? "Snaps Base Thickness and every color layer's height to whole layers at these settings, so each one's top surface lands exactly on a layer boundary instead of ending partway through one."
            : "Snaps Base Thickness, Relief Height, and Border Height to whole layers at these settings, so each one's top surface lands exactly on a layer boundary instead of ending partway through one."}
        </p>
        <button
          type="button"
          onClick={onNormalize}
          className="w-full rounded-md border border-cocoa-700 px-2 py-1.5 text-xs font-medium text-cocoa-200 transition-colors hover:bg-cocoa-800"
        >
          Normalize
        </button>
      </ParameterCard>

      <ParameterCard title="Cost Estimate" defaultOpen={false}>
        <CostEstimate {...estimate} unit={mode === "contour" ? "piece" : "coin"} />
      </ParameterCard>

      <ParameterCard title="Print & Slicer Reference" defaultOpen={false}>
        <PrintReferenceCard />
      </ParameterCard>
    </div>
  );
}
