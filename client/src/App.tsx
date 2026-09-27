import { useCallback, useEffect, useRef, useState } from "react";
import { generateModel } from "./api/client";
import { ActionBar } from "./components/ActionBar";
import { Sidebar } from "./components/Sidebar";
import { ThemeToggle } from "./components/ThemeToggle";
import { TipsPanel } from "./components/TipsPanel";
import { GeneratingOverlay } from "./components/viewer/GeneratingOverlay";
import { STLViewer } from "./components/viewer/STLViewer";
import { TokenLayoutPreview } from "./components/viewer/TokenLayoutPreview";
import { autoFitScaleForToken, defaultParams, medallionFields, type TokenPreset } from "./paramSchemas";
import type { Field, ParamValues, Quality } from "./types";
import { exportAppSettings, readAppSettingsFile } from "./utils/appSettings";
import { measureSvgFillRatio, readSvgNaturalSize, type SvgNaturalSize } from "./utils/svg";

// Matches the server's DEFAULT_FINAL_FACET_COUNT (server/src/lib/validation.ts).
const DEFAULT_RENDER_DETAIL = 96;

export default function App() {
  const [params, setParams] = useState<ParamValues>(() => defaultParams(medallionFields));
  const [svgFile, setSvgFile] = useState<File | null>(null);
  const [svgPreviewUrl, setSvgPreviewUrl] = useState<string | null>(null);
  const [svgNaturalSize, setSvgNaturalSize] = useState<SvgNaturalSize | null>(null);
  const [svgFillRatio, setSvgFillRatio] = useState<number | null>(null);
  // modelUrl/modelQuality track whatever is currently shown in the 3D
  // viewer (draft or final); downloadUrl only ever points at a Full
  // Render output, so a quick draft preview can never be mistaken for a
  // print-ready file.
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelQuality, setModelQuality] = useState<Quality | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [renderDetail, setRenderDetail] = useState(DEFAULT_RENDER_DETAIL);

  const paramsRef = useRef(params);
  paramsRef.current = params;

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

  const handleFieldChange = useCallback((key: string, value: Field["default"]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const runGenerate = useCallback(
    async (quality: Quality) => {
      const setBusy = quality === "draft" ? setIsPreviewing : setIsRendering;
      setBusy(true);
      setErrorMessage(null);
      try {
        const result = await generateModel({ params, file: svgFile, quality, renderDetail });
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
    [params, svgFile, renderDetail],
  );

  const handlePreview = useCallback(() => runGenerate("draft"), [runGenerate]);
  const handleRender = useCallback(() => runGenerate("final"), [runGenerate]);

  const handleSvgFile = useCallback((file: File | null) => {
    setSvgFile(file);
    if (!file) {
      setSvgNaturalSize(null);
      setSvgFillRatio(null);
      return;
    }

    // Fit the graphic to the current coin size right away so the instant
    // layout preview looks reasonable immediately, instead of an arbitrary
    // default scale that might render it comically over- or under-sized.
    // This is pure client-side math - no OpenSCAD round trip.
    readSvgNaturalSize(file)
      .then((natural) => {
        setSvgNaturalSize(natural);
        const autoScale = autoFitScaleForToken(natural, paramsRef.current);
        setParams((prev) => ({ ...prev, svg_scale: autoScale }));
      })
      .catch(() => {
        // Malformed SVG metadata - leave the existing scale; the layout
        // preview just won't auto-fit for this file.
      });

    // Measures actual ink coverage for the chocolate volume/cost estimate
    // - runs independently of the above, since it only feeds that
    // estimate rather than the layout preview.
    setSvgFillRatio(null);
    measureSvgFillRatio(file)
      .then(setSvgFillRatio)
      .catch(() => setSvgFillRatio(null));
  }, []);

  const handlePresetSelect = useCallback(
    (preset: TokenPreset) => {
      setParams((prev) => {
        const next: ParamValues = {
          ...prev,
          token_size: preset.size,
          base_thickness: preset.baseThickness,
          relief_height: preset.reliefHeight,
        };
        // Re-fit the graphic to the new size, same as on upload - otherwise
        // an image sized for one preset looks lost or oversized after
        // switching to another.
        if (svgNaturalSize) {
          next.svg_scale = autoFitScaleForToken(svgNaturalSize, next);
        }
        return next;
      });
    },
    [svgNaturalSize],
  );

  const showLayoutPreview = svgFile && svgPreviewUrl && svgNaturalSize;

  const handleSaveSettings = useCallback(
    (fileName: string) => {
      exportAppSettings({ renderDetail, medallionParams: params }, fileName);
    },
    [renderDetail, params],
  );

  const handleImportSettings = useCallback(async (file: File) => {
    try {
      const settings = await readAppSettingsFile(file);
      // Merge over the current schema's defaults rather than applying the
      // imported params verbatim - a file saved before a field existed
      // (e.g. the SVG offset fields) would otherwise leave that param
      // undefined instead of falling back to its default.
      setParams({ ...defaultParams(medallionFields), ...settings.medallionParams });
      setRenderDetail(settings.renderDetail);
      // The previous render/download no longer reflects the newly loaded
      // params.
      setModelUrl(null);
      setModelQuality(null);
      setDownloadUrl(null);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to import settings");
    }
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-cocoa-950">
      <header className="flex items-center gap-4 border-b border-cocoa-800 px-4 py-3">
        <div className="flex shrink-0 items-center gap-2">
          <img src="/favicon2.svg" alt="" className="h-7 w-7 rounded-md" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-cocoa-50">
              Chocolate Mold Factory
              <span className="ml-2 align-middle text-[10px] font-normal text-cocoa-500">v{__APP_VERSION__}</span>
            </h1>
            <p className="text-xs text-cocoa-400">Configure, preview, and generate a 3D-printable chocolate coin master.</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <TipsPanel />
          <ThemeToggle />
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <div className="grid h-full grid-cols-1 md:grid-cols-[340px_1fr]">
          <aside className="flex flex-col gap-4 overflow-y-auto border-b border-cocoa-800 p-4 md:border-b-0 md:border-r">
            <Sidebar
              fields={medallionFields}
              params={params}
              onChange={handleFieldChange}
              svgFile={svgFile}
              svgPreviewUrl={svgPreviewUrl}
              svgNaturalSize={svgNaturalSize}
              svgFillRatio={svgFillRatio}
              renderDetail={renderDetail}
              onRenderDetailChange={setRenderDetail}
              onSvgFile={handleSvgFile}
              onSelectPreset={handlePresetSelect}
            />
          </aside>

          <main className="flex min-h-0 flex-col">
            <div className="relative min-h-0 flex-1">
              {!modelUrl && showLayoutPreview ? (
                <TokenLayoutPreview
                  tokenSize={Number(params.token_size)}
                  borderStyle={String(params.border_style)}
                  borderDirection={String(params.border_direction)}
                  borderInset={Number(params.border_inset)}
                  svgUrl={svgPreviewUrl}
                  svgNaturalSize={svgNaturalSize}
                  svgScale={Number(params.svg_scale)}
                  svgOffsetX={Number(params.svg_offset_x)}
                  svgOffsetY={Number(params.svg_offset_y)}
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
              onSaveSettings={handleSaveSettings}
              onImportSettings={handleImportSettings}
              onPreview={handlePreview}
              onRender={handleRender}
              isPreviewing={isPreviewing}
              isRendering={isRendering}
              downloadUrl={downloadUrl}
              errorMessage={errorMessage}
              fileName={fileName}
              onFileNameChange={setFileName}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
