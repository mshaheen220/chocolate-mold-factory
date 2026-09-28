export type ParamType = "number" | "enum" | "boolean" | "string";

export interface NumberParamSpec {
  type: "number";
  min: number;
  max: number;
  default: number;
  integer?: boolean;
}

export interface EnumParamSpec {
  type: "enum";
  options: readonly string[];
  default: string;
}

export interface BooleanParamSpec {
  type: "boolean";
  default: boolean;
}

export interface StringParamSpec {
  type: "string";
  maxLength: number;
  /** Only characters this allows are accepted - keeps free text limited to what the OpenSCAD text() font can render. */
  pattern: RegExp;
  default: string;
}

export type ParamSpec = NumberParamSpec | EnumParamSpec | BooleanParamSpec | StringParamSpec;

export type ParamSchema = Record<string, ParamSpec>;

export type ScadValue = number | string | boolean;
export type ScadParams = Record<string, ScadValue>;

export interface GenerateResult {
  fileName: string;
  url: string;
  quality: "draft" | "final";
}
