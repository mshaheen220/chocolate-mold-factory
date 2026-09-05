export type Workflow = "medallion" | "mold_box";

export type ParamType = "number" | "enum" | "boolean";

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

export type ParamSpec = NumberParamSpec | EnumParamSpec | BooleanParamSpec;

export type ParamSchema = Record<string, ParamSpec>;

export type ScadValue = number | string | boolean;
export type ScadParams = Record<string, ScadValue>;

export interface GenerateResult {
  fileName: string;
  url: string;
  quality: "draft" | "final";
}
