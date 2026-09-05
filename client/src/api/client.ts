import type { GenerateResponse, ParamValues, Quality, Workflow } from "../types";

export interface GenerateRequest {
  workflow: Workflow;
  params: ParamValues;
  file?: File | null;
  quality?: Quality;
  renderDetail?: number;
}

export async function generateModel({
  workflow,
  params,
  file,
  quality = "final",
  renderDetail,
}: GenerateRequest): Promise<GenerateResponse> {
  const form = new FormData();
  form.append("workflow", workflow);
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

  const res = await fetch("/api/generate", { method: "POST", body: form });
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
