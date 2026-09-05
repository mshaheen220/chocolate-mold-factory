import { isTokenMode, type TokenPreset } from "../paramSchemas";
import type { Field, ParamValues, Workflow } from "../types";
import type { SvgNaturalSize } from "../utils/svg";
import { ParameterCard } from "./ParameterCard";
import { FieldRenderer } from "./FieldRenderer";
import { FileDropzone } from "./controls/FileDropzone";
import { TokenSizePresets } from "./controls/TokenSizePresets";

interface SidebarProps {
  workflow: Workflow;
  fields: Field[];
  params: ParamValues;
  onChange: (key: string, value: Field["default"]) => void;
  svgFile: File | null;
  svgPreviewUrl: string | null;
  svgNaturalSize: SvgNaturalSize | null;
  onSvgFile: (file: File | null) => void;
  onSelectPreset: (preset: TokenPreset) => void;
}

const GROUP_CARDS: { group: Field["group"]; title: string }[] = [
  { group: "geometry", title: "Geometry & Sizing" },
  { group: "border", title: "Raised Border" },
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
  onSvgFile,
  onSelectPreset,
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
    </div>
  );
}
