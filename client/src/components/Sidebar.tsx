import { isTokenMode, type TokenPreset } from "../paramSchemas";
import type { Field, ParamValues, Workflow } from "../types";
import type { SvgNaturalSize } from "../utils/svg";
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

interface SidebarProps {
  workflow: Workflow;
  fields: Field[];
  params: ParamValues;
  onChange: (key: string, value: Field["default"]) => void;
  svgFile: File | null;
  svgPreviewUrl: string | null;
  svgNaturalSize: SvgNaturalSize | null;
  svgFillRatio: number | null;
  onSvgFile: (file: File | null) => void;
  onSelectPreset: (preset: TokenPreset) => void;
  renderDetail: number;
  onRenderDetailChange: (value: number) => void;
}

const GROUP_CARDS: { group: Field["group"]; title: string }[] = [
  { group: "geometry", title: "Geometry & Sizing" },
  { group: "border", title: "Border" },
  { group: "cavity", title: "Mold Box Cavity" },
  { group: "frame", title: "Adjustable Mold Frame" },
];

export function Sidebar({
  workflow,
  fields,
  params,
  onChange,
  svgFile,
  svgPreviewUrl,
  svgNaturalSize,
  svgFillRatio,
  onSvgFile,
  onSelectPreset,
  renderDetail,
  onRenderDetailChange,
}: SidebarProps) {
  return (
    <div className="flex flex-col gap-4">
      {workflow === "medallion" && (
        <ParameterCard title="Asset Upload">
          <FileDropzone
            accept=".svg"
            label="Graphic (SVG)"
            file={svgFile}
            previewUrl={svgPreviewUrl}
            onFile={onSvgFile}
          />
          <p className="text-xs text-cocoa-400">
            Optional — without a graphic, the token base shape alone is generated.
          </p>
        </ParameterCard>
      )}

      {GROUP_CARDS.map(({ group, title }) => {
        const groupFields = fields.filter((f) => f.group === group);
        if (groupFields.length === 0) return null;

        const hasVisibleField = groupFields.some((f) => !f.showIf || f.showIf(params));
        // The primary "Geometry & Sizing" card always shows (it holds
        // render_mode itself); other cards hide entirely when nothing in
        // them currently applies.
        if (!hasVisibleField && group !== "geometry") return null;

        return (
          <ParameterCard key={group} title={title}>
            {group === "geometry" && workflow === "medallion" && isTokenMode(params) && (
              <TokenSizePresets params={params} svgNaturalSize={svgNaturalSize} onSelect={onSelectPreset} />
            )}
            {groupFields.map((field) => (
              <FieldRenderer key={field.key} field={field} params={params} onChange={onChange} />
            ))}
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

      {workflow === "medallion" && isTokenMode(params) && (
        <ParameterCard title="Cost Estimate" defaultOpen={false}>
          <CostEstimate params={params} svgNaturalSize={svgNaturalSize} svgFillRatio={svgFillRatio} />
        </ParameterCard>
      )}

      <ParameterCard title="Print & Slicer Reference" defaultOpen={false}>
        <PrintReferenceCard />
      </ParameterCard>
    </div>
  );
}
