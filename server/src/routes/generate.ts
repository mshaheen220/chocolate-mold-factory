import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { config } from "../config";
import { upload } from "../middleware/upload";
import { removeFile } from "../lib/cleanup";
import { OpenScadError, runOpenScad, type RenderOptions } from "../lib/openscad";
import { normalizeSvgForOpenScad } from "../lib/svg";
import {
  DRAFT_BEAD_COUNT_CAP,
  FACET_COUNT_BY_QUALITY,
  isWorkflow,
  parseQuality,
  schemasByWorkflow,
  templateByWorkflow,
  ValidationError,
  validateParams,
} from "../lib/validation";
import type { ScadParams } from "../types";

export const generateRouter = Router();

generateRouter.post("/generate", upload.single("file"), async (req, res) => {
  const uploadedFilePath = req.file?.path;

  try {
    const { workflow } = req.body as { workflow?: string };
    if (!isWorkflow(workflow)) {
      res.status(400).json({ error: "workflow must be one of: medallion, mold_box" });
      return;
    }

    const schema = schemasByWorkflow[workflow];
    const params: ScadParams = validateParams(schema, req.body ?? {});
    const quality = parseQuality((req.body as { quality?: string } | undefined)?.quality);
    const renderOptions: RenderOptions = {
      facetCount: FACET_COUNT_BY_QUALITY[quality],
      fastPreview: quality === "draft",
    };

    if (quality === "draft" && params.border_style === "beaded" && typeof params.bead_count === "number") {
      params.bead_count = Math.min(params.bead_count, DRAFT_BEAD_COUNT_CAP);
    }

    if (workflow === "medallion") {
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
    }

    const templatePath = path.join(config.paths.templates, templateByWorkflow[workflow]);
    const outputFileName = `${crypto.randomUUID()}.stl`;
    const outputPath = path.join(config.paths.output, outputFileName);

    await runOpenScad(templatePath, outputPath, params, renderOptions);

    res.status(201).json({
      fileName: outputFileName,
      url: `/api/output/${outputFileName}`,
      quality,
    });
  } catch (err) {
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
  } finally {
    if (uploadedFilePath) {
      await removeFile(uploadedFilePath);
    }
  }
});
