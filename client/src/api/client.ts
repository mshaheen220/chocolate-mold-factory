import type { GenerateResponse, ParamValues, Quality } from "../types";
import type { ContourUpload } from "../utils/contour";

export interface GenerateRequest {
  params: ParamValues;
  file?: File | null;
  quality?: Quality;
  renderDetail?: number;
}

export async function generateModel({
  params,
  file,
  quality = "final",
  renderDetail,
}: GenerateRequest): Promise<GenerateResponse> {
  const form = new FormData();
  form.append("quality", quality);
  if (renderDetail !== undefined) {
    form.append("render_detail", String(renderDetail));
  }
  for (const [key, value] of Object.entries(params)) {
    form.append(key, String(value));
  }
  if (file) {
    form.append("file", file);
  }

  return postGenerate("/api/generate", form);
}

export interface GenerateContourRequest {
  params: ParamValues;
  upload: ContourUpload;
  quality?: Quality;
  renderDetail?: number;
}

export async function generateContourModel({
  params,
  upload,
  quality = "final",
  renderDetail,
}: GenerateContourRequest): Promise<GenerateResponse> {
  const form = new FormData();
  form.append("quality", quality);
  if (renderDetail !== undefined) {
    form.append("render_detail", String(renderDetail));
  }
  for (const [key, value] of Object.entries(params)) {
    form.append(key, String(value));
  }
  form.append("art_width", String(upload.artWidth));
  form.append("art_height", String(upload.artHeight));
  form.append("label_x", String(upload.labelX));
  form.append("label_y", String(upload.labelY));
  form.append("layer_heights", JSON.stringify(upload.heights));
  form.append("layer_included", JSON.stringify(upload.included));
  for (const file of upload.files) {
    form.append("layers", file);
  }
  return postGenerate("/api/generate/contour", form);
}

async function postGenerate(url: string, form: FormData): Promise<GenerateResponse> {
  const res = await fetch(url, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issues = Array.isArray(body.issues) ? `: ${body.issues.join(", ")}` : "";
    throw new Error((body.error ?? `Request failed with status ${res.status}`) + issues);
  }
  return body as GenerateResponse;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  openscad: { available: boolean; version?: string; error?: string };
  timestamp: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  return res.json();
}

export interface Tip {
  category: string;
  text: string;
}

export async function fetchTips(): Promise<Tip[]> {
  const res = await fetch("/api/tips");
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  const body = await res.json();
  return body.tips as Tip[];
}
