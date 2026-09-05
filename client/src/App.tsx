import { useCallback, useEffect, useRef, useState } from "react";
import { generateModel } from "./api/client";
import { ActionBar } from "./components/ActionBar";
import { Sidebar } from "./components/Sidebar";
import { TabSwitcher } from "./components/TabSwitcher";
import { GeneratingOverlay } from "./components/viewer/GeneratingOverlay";
import { STLViewer } from "./components/viewer/STLViewer";
import { TokenLayoutPreview } from "./components/viewer/TokenLayoutPreview";
import { defaultParams, isTokenMode, medallionFields, moldBoxFields } from "./paramSchemas";
import type { Field, ParamValues, Quality, Workflow } from "./types";
import { computeAutoFitScale, readSvgNaturalSize, type SvgNaturalSize } from "./utils/svg";

export default function App() {
  const [workflow, setWorkflow] = useState<Workflow>("medallion");
  const [medallionParams, setMedallionParams] = useState<ParamValues>(() => defaultParams(medallionFields));
  const [moldBoxParams, setMoldBoxParams] = useState<ParamValues>(() => defaultParams(moldBoxFields));
  const [svgFile, setSvgFile] = useState<File | null>(null);
  const [svgPreviewUrl, setSvgPreviewUrl] = useState<string | null>(null);
  const [svgNaturalSize, setSvgNaturalSize] = useState<SvgNaturalSize | null>(null);
  // modelUrl/modelQuality track whatever is currently shown in the 3D
  // viewer (draft or final); downloadUrl only ever points at a Full
  // Render output, so a quick draft preview can never be mistaken for a
  // print-ready file.
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelQuality, setModelQuality] = useState<Quality | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const medallionParamsRef = useRef(medallionParams);
  medallionParamsRef.current = medallionParams;

  const fields = workflow === "medallion" ? medallionFields : moldBoxFields;
  const params = workflow === "medallion" ? medallionParams : moldBoxParams;
  const setParams = workflow === "medallion" ? setMedallionParams : setMoldBoxParams;

  // A single object URL per uploaded file, shared by the dropzone thumbnail
  // and the instant layout preview below.
  useEffect(() => {
    if (!svgFile) {
      setSvgPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(svgFile);
    setSvgPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [svgFile]);

  const handleFieldChange = useCallback(
    (key: string, value: Field["default"]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    [setParams],
  );

  const runGenerate = useCallback(
    async (quality: Quality) => {
      const setBusy = quality === "draft" ? setIsPreviewing : setIsRendering;
      setBusy(true);
      setErrorMessage(null);
      try {
        const result = await generateModel({
          workflow,
          params,
          file: workflow === "medallion" ? svgFile : undefined,
          quality,
        });
        setModelUrl(result.url);
        setModelQuality(result.quality);
        if (result.quality === "final") {
          setDownloadUrl(result.url);
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setBusy(false);
      }
    },
    [workflow, params, svgFile],
  );

  const handlePreview = useCallback(() => runGenerate("draft"), [runGenerate]);
  const handleRender = useCallback(() => runGenerate("final"), [runGenerate]);

  const handleSvgFile = useCallback((file: File | null) => {
    setSvgFile(file);
    if (!file) {
      setSvgNaturalSize(null);
      return;
    }

    // Fit the graphic to the current token footprint right away so the
    // instant layout preview looks reasonable immediately, instead of an
    // arbitrary default scale that might render it comically over- or
    // under-sized. This is pure client-side math - no OpenSCAD round trip.
    readSvgNaturalSize(file)
      .then((natural) => {
        setSvgNaturalSize(natural);
        const current = medallionParamsRef.current;
        const shape = current.token_shape;
        const targetWidth = Number(current.token_size);
        const targetHeight = shape === "oval" || shape === "rectangle" ? Number(current.token_length) : targetWidth;
        const autoScale = computeAutoFitScale(natural, targetWidth, targetHeight);
        setMedallionParams((prev) => ({ ...prev, svg_scale: autoScale }));
      })
      .catch(() => {
        // Malformed SVG metadata - leave the existing scale; the layout
        // preview just won't auto-fit for this file.
      });
  }, []);

  const showLayoutPreview =
    workflow === "medallion" && svgFile && svgPreviewUrl && svgNaturalSize && isTokenMode(params);

  return (
    <div className="flex h-screen w-screen flex-col bg-cocoa-950">
      <header className="flex items-center gap-2 border-b border-cocoa-800 px-4 py-3">
        <img src="/favicon2.svg" alt="" className="h-7 w-7 rounded-md" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-cocoa-50">Chocolate Mold Factory</h1>
          <p className="text-xs text-cocoa-400">Configure, preview, and generate 3D-printable mold assets.</p>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <div className="grid h-full grid-cols-1 md:grid-cols-[340px_1fr]">
          <aside className="flex flex-col gap-4 overflow-y-auto border-b border-cocoa-800 p-4 md:border-b-0 md:border-r">
            <TabSwitcher
              workflow={workflow}
              onChange={(w) => {
                setWorkflow(w);
                setErrorMessage(null);
              }}
            />
            <Sidebar
              workflow={workflow}
              fields={fields}
              params={params}
              onChange={handleFieldChange}
              svgFile={svgFile}
              svgPreviewUrl={svgPreviewUrl}
              onSvgFile={handleSvgFile}
            />
          </aside>

          <main className="flex min-h-0 flex-col">
            <div className="relative min-h-0 flex-1">
              {!modelUrl && showLayoutPreview ? (
                <TokenLayoutPreview
                  tokenShape={String(params.token_shape)}
                  tokenSize={Number(params.token_size)}
                  tokenLength={Number(params.token_length)}
                  cornerRadius={Number(params.corner_radius)}
                  borderStyle={String(params.border_style)}
                  borderInset={Number(params.border_inset)}
                  svgUrl={svgPreviewUrl}
                  svgNaturalSize={svgNaturalSize}
                  svgScale={Number(params.svg_scale)}
                />
              ) : (
                <STLViewer url={modelUrl} />
              )}
              {modelUrl && modelQuality === "draft" && !isPreviewing && !isRendering && (
                <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-amber-600/60 bg-amber-950/80 px-3 py-1 text-xs font-medium text-amber-200 shadow">
                  Draft preview (low facet count) — Full Render for print-quality output
                </div>
              )}
              {(isPreviewing || isRendering) && <GeneratingOverlay quality={isPreviewing ? "draft" : "final"} />}
            </div>
            <ActionBar
              onPreview={handlePreview}
              onRender={handleRender}
              isPreviewing={isPreviewing}
              isRendering={isRendering}
              downloadUrl={downloadUrl}
              errorMessage={errorMessage}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
