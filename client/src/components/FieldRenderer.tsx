import { isFieldVisible } from "../paramSchemas";
import type { Field, ParamValues } from "../types";
import { NumberField } from "./controls/NumberField";
import { SelectField } from "./controls/SelectField";
import { CheckboxField } from "./controls/CheckboxField";
import { TextField } from "./controls/TextField";

interface FieldRendererProps {
  field: Field;
  params: ParamValues;
  onChange: (key: string, value: Field["default"]) => void;
}

export function FieldRenderer({ field, params, onChange }: FieldRendererProps) {
  if (!isFieldVisible(field, params)) return null;
  const label = field.labelFor ? field.labelFor(params) : field.label;

  if (field.type === "number") {
    return (
      <NumberField
        label={label}
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
        label={label}
        value={params[field.key] as string}
        options={field.options}
        onChange={(v) => onChange(field.key, v)}
      />
    );
  }

  if (field.type === "string") {
    return (
      <TextField
        label={label}
        value={params[field.key] as string}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        onChange={(v) => onChange(field.key, field.sanitize ? field.sanitize(v) : v)}
      />
    );
  }

  return (
    <CheckboxField
      label={label}
      checked={Boolean(params[field.key])}
      onChange={(v) => onChange(field.key, v)}
    />
  );
}
