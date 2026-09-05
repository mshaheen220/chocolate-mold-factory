import type { Field, ParamValues } from "../types";
import { NumberField } from "./controls/NumberField";
import { SelectField } from "./controls/SelectField";
import { CheckboxField } from "./controls/CheckboxField";

interface FieldRendererProps {
  field: Field;
  params: ParamValues;
  onChange: (key: string, value: Field["default"]) => void;
}

export function FieldRenderer({ field, params, onChange }: FieldRendererProps) {
  if (field.showIf && !field.showIf(params)) return null;

  if (field.type === "number") {
    return (
      <NumberField
        label={field.label}
        value={params[field.key] as number}
        min={field.min}
        max={field.max}
        step={field.step}
        unit={field.unit}
        onChange={(v) => onChange(field.key, v)}
      />
    );
  }

  if (field.type === "enum") {
    return (
      <SelectField
        label={field.label}
        value={params[field.key] as string}
        options={field.options}
        onChange={(v) => onChange(field.key, v)}
      />
    );
  }

  return (
    <CheckboxField
      label={field.label}
      checked={Boolean(params[field.key])}
      onChange={(v) => onChange(field.key, v)}
    />
  );
}
