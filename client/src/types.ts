export type Quality = "draft" | "final";

export type ParamValue = number | string | boolean;

/** The user-facing Piece Shape choice. */
export type PieceShape = "circle" | "oval" | "square" | "rectangle" | "contour";

/**
 * Which generator a shape uses: "coin" = a geometric token (circle, oval,
 * square, rectangle - medallion.scad); "contour" = the outline follows the
 * uploaded artwork (contour.scad).
 */
export type PieceMode = "coin" | "contour";
export type ParamValues = Record<string, ParamValue>;

interface BaseField {
  key: string;
  label: string;
  group: "geometry" | "layers" | "border" | "label";
  /** Only applies to (and is only sent to the server for) this mode. Omit for fields shared by both. */
  mode?: PieceMode;
  /** Overrides `label` when it depends on other params (e.g. "Diameter" vs "Width"). */
  labelFor?: (params: ParamValues) => string;
  /** Drives client-side behavior only - never sent to the server. */
  clientOnly?: boolean;
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
