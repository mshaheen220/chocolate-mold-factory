import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateContourModel, generateModel } from "./api/client";
import { ActionBar } from "./components/ActionBar";
import { Sidebar } from "./components/Sidebar";
import { ThemeToggle } from "./components/ThemeToggle";
import { TipsPanel } from "./components/TipsPanel";
import { GeneratingOverlay } from "./components/viewer/GeneratingOverlay";
import { ContourLayoutPreview } from "./components/viewer/ContourLayoutPreview";
import { STLViewer } from "./components/viewer/STLViewer";
import { TokenLayoutPreview } from "./components/viewer/TokenLayoutPreview";
import {
  autoFitScaleForToken,
  defaultParams,
  medallionFields,
  paramsForServer,
  hasBasePlate,
  pieceModeOf,
  pieceShapeOf,
  tokenLengthOf,
  type TokenPreset,
} from "./paramSchemas";
import type { Field, ParamValues, Quality } from "./types";
import { buildAppSettingsPayload, exportAppSettings, readAppSettingsFile } from "./utils/appSettings";
import { downloadBlob } from "./utils/downloadFile";
import {
  analyzeArtwork,
  buildContourUpload,
  type ArtworkModel,
  type ColorSetting,
  type ColorSettings,
  defaultColorSettings,
  DRAFT_TOLERANCE_MM,
  FINAL_TOLERANCE_MM,
  measureContour,
  prepareContour,
} from "./utils/contour";
import { normalizeToLayers, snapToFirstLayerStack, snapToLayerMultiple } from "./utils/normalize";
import { coinFootprint, computeTokenVolume } from "./utils/volume";
import { measureSvgFillRatio, readSvgNaturalSize, type SvgNaturalSize } from "./utils/svg";
import { createZip } from "./utils/zip";

// Matches the server's DEFAULT_FINAL_FACET_COUNT (server/src/lib/validation.ts).
const DEFAULT_RENDER_DETAIL = 96;

// Match the Print & Slicer Reference card's own recommendation (see
// printRecommendations.ts) so the normalize inputs default to the same
// numbers a user would already be using in their slicer.
const DEFAULT_LAYER_HEIGHT = 0.09;
const DEFAULT_FIRST_LAYER_HEIGHT = 0.12;

function numberFieldBounds(fields: Field[], key: string): { min: number; max: number } {
  const field = fields.find((f) => f.key === key);
  return field && field.type === "number" ? { min: field.min, max: field.max } : { min: -Infinity, max: Infinity };
}

export default function App() {
  const [params, setParams] = useState<ParamValues>(() => defaultParams(medallionFields));
  const [svgFile, setSvgFile] = useState<File | null>(null);
  const [svgPreviewUrl, setSvgPreviewUrl] = useState<string | null>(null);
  const [svgNaturalSize, setSvgNaturalSize] = useState<SvgNaturalSize | null>(null);
  const [svgFillRatio, setSvgFillRatio] = useState<number | null>(null);
  // Contoured pieces: the uploaded SVG split into filled shapes by color,
  // and each color's role/height in the piece.
  const [artwork, setArtwork] = useState<ArtworkModel | null>(null);
  const [artworkError, setArtworkError] = useState<string | null>(null);
  const [colorSettings, setColorSettings] = useState<ColorSettings>({});
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
  const [isPackaging, setIsPackaging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [renderDetail, setRenderDetail] = useState(DEFAULT_RENDER_DETAIL);
  const [layerHeight, setLayerHeight] = useState(DEFAULT_LAYER_HEIGHT);
  const [firstLayerHeight, setFirstLayerHeight] = useState(DEFAULT_FIRST_LAYER_HEIGHT);
  // True once params/svgFile have changed since the 3D model currently in
  // modelUrl was generated - the viewer falls back to the instant 2D
  // layout preview while stale, rather than silently showing a 3D model
  // that no longer matches the sidebar (renderDetail is deliberately
  // excluded - it only affects Full Render's facet smoothness, which the
  // vector-based 2D preview can't show anyway).
  const [isStale, setIsStale] = useState(false);

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    setIsStale(true);
  }, [params, svgFile, colorSettings]);

  const pieceMode = pieceModeOf(params);

  const basePlate = useMemo(
    () =>
      hasBasePlate(params)
        ? { border: Number(params.plate_border), thickness: Number(params.plate_thickness) }
        : null,
    [params],
  );

  const preparedContour = useMemo(
    () =>
      artwork
        ? prepareContour(
            artwork,
            colorSettings,
            Number(params.speck_filter),
            params.contour_relief_direction === "recessed" ? "recessed" : "raised",
          )
        : null,
    [artwork, colorSettings, params.speck_filter, params.contour_relief_direction],
  );

  const estimate = useMemo(() => {
    if (pieceMode === "contour") {
      if (!preparedContour) {
        return { totalVolumeMm3: 0, footprint: { areaMm2: 0, perimeterMm: 0, baseThickness: 0 }, measuredArtwork: false };
      }
      const m = measureContour(
        preparedContour,
        Number(params.piece_size),
        Number(params.base_thickness),
        Number(params.outline_margin),
        basePlate,
      );
      return {
        totalVolumeMm3: m.volumeMm3,
        footprint: {
          areaMm2: m.footprintAreaMm2,
          perimeterMm: m.perimeterMm,
          baseThickness: Number(params.base_thickness) + (basePlate?.thickness ?? 0),
        },
        measuredArtwork: true,
      };
    }
    return {
      totalVolumeMm3: computeTokenVolume(params, svgNaturalSize, svgFillRatio).totalVolumeMm3,
      footprint: coinFootprint(params),
      measuredArtwork: svgFillRatio !== null,
    };
  }, [pieceMode, preparedContour, params, svgNaturalSize, svgFillRatio, basePlate]);

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
        let result;
        if (pieceMode === "contour") {
          if (!preparedContour) {
            throw new Error(
              artwork
                ? "Mark at least one color as part of the piece first"
                : "Upload an SVG graphic first - a contoured piece takes its outline from it",
            );
          }
          const upload = buildContourUpload(
            preparedContour,
            Number(params.piece_size),
            quality === "draft" ? DRAFT_TOLERANCE_MM : FINAL_TOLERANCE_MM,
          );
          result = await generateContourModel({
            params: paramsForServer(medallionFields, params),
            upload,
            quality,
            renderDetail,
          });
        } else {
          result = await generateModel({
            params: paramsForServer(medallionFields, params),
            file: svgFile,
            quality,
            renderDetail,
          });
        }
        setModelUrl(result.url);
        setModelQuality(result.quality);
        setIsStale(false);
        if (result.quality === "final") {
          setDownloadUrl(result.url);
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setBusy(false);
      }
    },
    [params, svgFile, renderDetail, pieceMode, preparedContour, artwork],
  );

  const handlePreview = useCallback(() => runGenerate("draft"), [runGenerate]);
  const handleRender = useCallback(() => runGenerate("final"), [runGenerate]);

  const handleColorSettingChange = useCallback((color: string, setting: ColorSetting) => {
    setColorSettings((prev) => ({ ...prev, [color]: setting }));
  }, []);

  const handleSvgFile = useCallback((file: File | null) => {
    setSvgFile(file);
    setArtwork(null);
    setArtworkError(null);
    if (!file) {
      setSvgNaturalSize(null);
      setSvgFillRatio(null);
      return;
    }

    // Split into color layers for contoured pieces. Done on every upload
    // (not just in contour mode) so switching Piece Shape afterwards
    // needs no re-upload. Settings already held for a color (e.g. from an
    // imported settings file) win over the defaults.
    analyzeArtwork(file)
      .then((model) => {
        setArtwork(model);
        setColorSettings((prev) => {
          const next = defaultColorSettings(model);
          for (const key of Object.keys(next)) {
            if (prev[key]) next[key] = prev[key];
          }
          return next;
        });
      })
      .catch((err) => setArtworkError(err instanceof Error ? err.message : "Could not read this SVG's shapes"));

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

  const handleNormalize = useCallback(() => {
    if (pieceMode === "contour") {
      setColorSettings((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, setting]) => {
            if (setting.height === 0) return [key, setting];
            const snapped = snapToLayerMultiple(Math.abs(setting.height), layerHeight);
            return [key, { ...setting, height: Math.sign(setting.height) * Number(snapped.toFixed(4)) }];
          }),
        ),
      );
    }
    setParams((prev) => {
      const normalized = normalizeToLayers(
        {
          baseThickness: Number(prev.base_thickness),
          reliefHeight: Number(prev.relief_height),
          borderHeight: Number(prev.border_height),
        },
        { layerHeight, firstLayerHeight },
        {
          baseThickness: numberFieldBounds(medallionFields, "base_thickness"),
          reliefHeight: numberFieldBounds(medallionFields, "relief_height"),
          borderHeight: numberFieldBounds(medallionFields, "border_height"),
        },
      );
      const next: ParamValues = {
        ...prev,
        base_thickness: normalized.baseThickness,
        relief_height: normalized.reliefHeight,
        border_height: normalized.borderHeight,
      };
      if (hasBasePlate(prev)) {
        // The plate is what sits on the bed now; the design's own height
        // is whole layers stacked on the plate's already-aligned top.
        const clampTo = (key: string, value: number) => {
          const { min, max } = numberFieldBounds(medallionFields, key);
          return Number(Math.min(max, Math.max(min, value)).toFixed(4));
        };
        next.plate_thickness = clampTo(
          "plate_thickness",
          snapToFirstLayerStack(Number(prev.plate_thickness), { layerHeight, firstLayerHeight }, 1),
        );
        next.base_thickness = clampTo("base_thickness", snapToLayerMultiple(Number(prev.base_thickness), layerHeight));
      }
      return next;
    });
  }, [layerHeight, firstLayerHeight, pieceMode]);

  const handleSaveSettings = useCallback(
    (fileName: string) => {
      exportAppSettings({ renderDetail, medallionParams: params, contourColors: colorSettings }, fileName);
    },
    [renderDetail, params, colorSettings],
  );

  const handleImportSettings = useCallback(async (file: File) => {
    try {
      const settings = await readAppSettingsFile(file);
      // Merge over the current schema's defaults rather than applying the
      // imported params verbatim - a file saved before a field existed
      // (e.g. the SVG offset fields) would otherwise leave that param
      // undefined instead of falling back to its default. Also drop any
      // imported key the current schema no longer has (e.g. render_mode,
      // token_shape, grid_x from a file saved before the mold-box/shape
      // removal) - carrying those forward would get them silently
      // resubmitted to the server on generate, which rejects unknown
      // fields outright.
      const knownKeys = new Set(medallionFields.map((f) => f.key));
      const importedParams = Object.fromEntries(
        Object.entries(settings.medallionParams).filter(([key]) => knownKeys.has(key)),
      );
      // Files saved before Piece Shape existed (or while shapes briefly
      // weren't offered) stored the coin shape as token_shape.
      if (importedParams.piece_shape === undefined && typeof settings.medallionParams.token_shape === "string") {
        importedParams.piece_shape = settings.medallionParams.token_shape;
      }
      if (importedParams.piece_shape === "coin") importedParams.piece_shape = "circle";
      setParams({ ...defaultParams(medallionFields), ...importedParams });
      setRenderDetail(settings.renderDetail);
      if (settings.contourColors) {
        setColorSettings((prev) => ({ ...prev, ...settings.contourColors }));
      }
      // The previous render/download no longer reflects the newly loaded
      // params.
      setModelUrl(null);
      setModelQuality(null);
      setDownloadUrl(null);
      setIsStale(false);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to import settings");
    }
  }, []);

  const handleDownloadPackage = useCallback(
    async (rawFileName: string) => {
      if (!downloadUrl) return;
      setIsPackaging(true);
      setErrorMessage(null);
      try {
        const trimmed = rawFileName.trim();
        // Strip a typed .stl/.zip extension - it's re-added below once we
        // know whether it's naming the .stl inside or the .zip around it.
        const base = trimmed
          ? trimmed.replace(/\.(stl|zip)$/i, "")
          : `chocolate-mold-factory-${pieceMode === "contour" ? "piece" : "coin"}`;

        const stlResponse = await fetch(downloadUrl);
        if (!stlResponse.ok) throw new Error("Failed to fetch the generated STL");
        const stlBytes = new Uint8Array(await stlResponse.arrayBuffer());

        const settingsPayload = buildAppSettingsPayload({
          renderDetail,
          medallionParams: params,
          contourColors: colorSettings,
        });
        const settingsBytes = new TextEncoder().encode(JSON.stringify(settingsPayload, null, 2));

        const zipBlob = createZip([
          { name: `${base}.stl`, data: stlBytes },
          { name: "settings.json", data: settingsBytes },
        ]);
        downloadBlob(`${base}.zip`, zipBlob);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to build the download package");
      } finally {
        setIsPackaging(false);
      }
    },
    [downloadUrl, renderDetail, params, colorSettings, pieceMode],
  );

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
            <p className="text-xs text-cocoa-400">
              Configure, preview, and generate a 3D-printable chocolate coin or contoured piece master.
            </p>
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
              artwork={artwork}
              artworkError={artworkError}
              colorSettings={colorSettings}
              onColorSettingChange={handleColorSettingChange}
              removedSpeckCount={preparedContour?.removedSpeckCount ?? 0}
              estimate={estimate}
              renderDetail={renderDetail}
              onRenderDetailChange={setRenderDetail}
              layerHeight={layerHeight}
              onLayerHeightChange={setLayerHeight}
              firstLayerHeight={firstLayerHeight}
              onFirstLayerHeightChange={setFirstLayerHeight}
              onNormalize={handleNormalize}
              onSvgFile={handleSvgFile}
              onSelectPreset={handlePresetSelect}
            />
          </aside>

          <main className="flex min-h-0 flex-col">
            <div className="relative min-h-0 flex-1">
              {(!modelUrl || isStale) && pieceMode === "contour" ? (
                <ContourLayoutPreview
                  prepared={preparedContour}
                  pieceSize={Number(params.piece_size)}
                  outlineMargin={Number(params.outline_margin)}
                  plate={basePlate}
                  emptyMessage={
                    artworkError ??
                    (artwork
                      ? "Mark at least one color as part of the piece under Color Layers."
                      : "Upload an SVG graphic - the piece's outline follows its filled shapes.")
                  }
                />
              ) : !modelUrl || isStale ? (
                <TokenLayoutPreview
                  tokenShape={pieceShapeOf(params)}
                  tokenSize={Number(params.token_size)}
                  tokenLength={tokenLengthOf(params)}
                  cornerRadius={Number(params.corner_radius)}
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
              {modelUrl && !isStale && modelQuality === "draft" && !isPreviewing && !isRendering && (
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
              onDownloadPackage={handleDownloadPackage}
              isPreviewing={isPreviewing}
              isRendering={isRendering}
              isPackaging={isPackaging}
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
