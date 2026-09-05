import { execFile } from "node:child_process";
import { config } from "../config";
import { escapeScadString } from "./validation";
import type { ScadParams } from "../types";

export class OpenScadError extends Error {
  constructor(
    message: string,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = "OpenScadError";
  }
}

export interface RenderOptions {
  /**
   * Always wins over any `$fn` the template itself assigns (confirmed
   * empirically: a CLI `-D` for a special variable overrides a later
   * top-level assignment of that same variable in the .scad file) - this
   * is how draft/final quality is controlled without touching templates.
   */
  facetCount: number;
  /**
   * Tells medallion.scad to swap an imported SVG relief for its convex
   * hull. A detailed illustration's own point count dominates compile
   * time independent of $fn, so this - not facet count - is what makes a
   * draft render of a complex graphic fast.
   */
  fastPreview: boolean;
}

/**
 * Builds the argv array for the OpenSCAD CLI. We always invoke via
 * execFile with an argument array (never a shell string), so there is no
 * shell to inject into. Every value has already been validated/coerced by
 * validateParams() against a strict schema before it reaches here.
 */
export function buildScadArgs(
  templatePath: string,
  outputPath: string,
  params: ScadParams,
  { facetCount, fastPreview }: RenderOptions,
): string[] {
  const args: string[] = ["-o", outputPath, "-D", `$fn=${facetCount}`, "-D", `fast_preview=${fastPreview}`];

  for (const [key, value] of Object.entries(params)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      // Defense in depth: schema keys are hardcoded, but never let a
      // malformed variable name reach the CLI.
      throw new Error(`Refusing to pass unsafe OpenSCAD variable name: ${key}`);
    }

    let serialized: string;
    if (typeof value === "number") {
      serialized = String(value);
    } else if (typeof value === "boolean") {
      serialized = value ? "true" : "false";
    } else {
      serialized = `"${escapeScadString(value)}"`;
    }

    args.push("-D", `${key}=${serialized}`);
  }

  args.push(templatePath);
  return args;
}

export function runOpenScad(
  templatePath: string,
  outputPath: string,
  params: ScadParams,
  renderOptions: RenderOptions,
): Promise<void> {
  const args = buildScadArgs(templatePath, outputPath, params, renderOptions);

  return new Promise((resolve, reject) => {
    execFile(
      config.openscadBin,
      args,
      { timeout: config.openscadTimeoutMs, maxBuffer: 10 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          // execFile's timeout kills the process rather than letting
          // OpenSCAD report an error, so stderr is typically empty here -
          // the generic "Command failed" message alone tells the user
          // nothing actionable about what actually happened.
          if (error.killed || error.signal) {
            reject(
              new OpenScadError(
                `OpenSCAD render timed out after ${Math.round(config.openscadTimeoutMs / 1000)}s. Beaded borders and detailed uploaded graphics are the most common cause - try Quick Preview first, or reduce bead count / border complexity.`,
                stderr,
              ),
            );
            return;
          }
          reject(new OpenScadError(`OpenSCAD compile failed: ${error.message}`, stderr));
          return;
        }
        resolve();
      },
    );
  });
}

export function checkOpenScadAvailable(): Promise<{ available: boolean; version?: string; error?: string }> {
  return new Promise((resolve) => {
    execFile(config.openscadBin, ["--version"], { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ available: false, error: error.message });
        return;
      }
      resolve({ available: true, version: (stdout || stderr).trim() });
    });
  });
}
