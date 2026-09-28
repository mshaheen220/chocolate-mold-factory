export type Quality = "draft" | "final";

export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

interface BaseField {
  key: string;
  label: string;
  group: "geometry" | "border" | "label";
  showIf?: (params: ParamValues) => boolean;
  helpText?: string;
}

export interface NumberField extends BaseField {
  type: "number";
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface EnumField extends BaseField {
  type: "enum";
  options: { value: string; label: string }[];
  default: string;
}

export interface BooleanField extends BaseField {
  type: "boolean";
  default: boolean;
}

export interface StringField extends BaseField {
  type: "string";
  maxLength: number;
  placeholder?: string;
  default: string;
  /** Strips disallowed characters live as the user types, rather than only
   * surfacing a validation error after Preview/Render. */
  sanitize?: (value: string) => string;
}

export type Field = NumberField | EnumField | BooleanField | StringField;

export interface GenerateResponse {
  fileName: string;
  url: string;
  quality: Quality;
}
