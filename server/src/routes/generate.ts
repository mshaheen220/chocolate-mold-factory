import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router, type Response } from "express";
import { config } from "../config";
import { layerUpload, upload } from "../middleware/upload";
import { removeFile } from "../lib/cleanup";
import { OpenScadError, runOpenScad, type RenderOptions } from "../lib/openscad";
import { normalizeSvgForOpenScad } from "../lib/svg";
import {
  CONTOUR_LAYER_FIELDS,
  CONTOUR_TEMPLATE_FILE,
  contourSchema,
  DRAFT_BEAD_COUNT_CAP,
  DRAFT_FACET_COUNT,
  medallionSchema,
  parseContourLayers,
  parseQuality,
  parseRenderDetail,
  type Quality,
  TEMPLATE_FILE,
  ValidationError,
  validateParams,
} from "../lib/validation";
import type { ScadParams } from "../types";

export const generateRouter = Router();

function renderOptionsFor(quality: Quality, rawRenderDetail: unknown): RenderOptions {
  return {
    facetCount: quality === "draft" ? DRAFT_FACET_COUNT : parseRenderDetail(rawRenderDetail),
    fastPreview: quality === "draft",
  };
}

async function compileAndRespond(
  res: Response,
  templateFile: string,
  params: ScadParams,
  quality: Quality,
  renderOptions: RenderOptions,
): Promise<void> {
  const templatePath = path.join(config.paths.templates, templateFile);
  const outputFileName = `${crypto.randomUUID()}.stl`;
  const outputPath = path.join(config.paths.output, outputFileName);

  await runOpenScad(templatePath, outputPath, params, renderOptions);

  res.status(201).json({
    fileName: outputFileName,
    url: `/api/output/${outputFileName}`,
    quality,
  });
}

function respondWithError(res: Response, err: unknown): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message, issues: err.issues });
    return;
  }
  if (err instanceof OpenScadError) {
    console.error("[generate] openscad failure:", err.stderr);
    res.status(422).json({ error: err.message, details: err.stderr.slice(0, 2000) });
    return;
  }
  console.error("[generate] unexpected error:", err);
  res.status(500).json({ error: "Internal server error" });
}

generateRouter.post("/generate", upload.single("file"), async (req, res) => {
  const uploadedFilePath = req.file?.path;

  try {
    const params: ScadParams = validateParams(medallionSchema, req.body ?? {});
    const body = req.body as { quality?: string; render_detail?: string } | undefined;
    const quality = parseQuality(body?.quality);
    const renderOptions = renderOptionsFor(quality, body?.render_detail);

    if (quality === "draft" && params.border_style === "beaded" && typeof params.bead_count === "number") {
      params.bead_count = Math.min(params.bead_count, DRAFT_BEAD_COUNT_CAP);
    }

    if (req.file) {
      if (path.extname(req.file.filename).toLowerCase() !== ".svg") {
        res.status(400).json({ error: "Uploaded file must be an .svg graphic" });
        return;
      }
      const rawSvg = await fs.readFile(req.file.path, "utf8");
      await fs.writeFile(req.file.path, normalizeSvgForOpenScad(rawSvg), "utf8");
      params.svg_path = req.file.path;
    } else {
      params.svg_path = "";
    }

    await compileAndRespond(res, TEMPLATE_FILE, params, quality, renderOptions);
  } catch (err) {
    respondWithError(res, err);
  } finally {
    if (uploadedFilePath) {
      await removeFile(uploadedFilePath);
    }
  }
});

/**
 * Contoured piece: the client has already split the artwork into one
 * flattened SVG per color layer (bottom to top), so this route only has to
 * validate them and hand the list to contour.scad alongside each layer's
 * height and whether it's part of the piece.
 */
generateRouter.post("/generate/contour", layerUpload.array("layers"), async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];

  try {
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const params: ScadParams = validateParams(contourSchema, raw, CONTOUR_LAYER_FIELDS);
    const { heights, included } = parseContourLayers(raw, files.length);
    const quality = parseQuality(raw.quality);
    const renderOptions = renderOptionsFor(quality, raw.render_detail);

    for (const file of files) {
      if (path.extname(file.filename).toLowerCase() !== ".svg") {
        res.status(400).json({ error: "Every layer file must be an .svg graphic" });
        return;
      }
      const rawSvg = await fs.readFile(file.path, "utf8");
      await fs.writeFile(file.path, normalizeSvgForOpenScad(rawSvg), "utf8");
    }

    params.layer_paths = files.map((f) => f.path);
    params.layer_heights = heights;
    params.layer_included = included;

    await compileAndRespond(res, CONTOUR_TEMPLATE_FILE, params, quality, renderOptions);
  } catch (err) {
    respondWithError(res, err);
  } finally {
    await Promise.all(files.map((f) => removeFile(f.path)));
  }
});
