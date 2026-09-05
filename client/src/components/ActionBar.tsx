interface ActionBarProps {
  onPreview: () => void;
  onRender: () => void;
  isPreviewing: boolean;
  isRendering: boolean;
  downloadUrl: string | null;
  errorMessage: string | null;
}

export function ActionBar({ onPreview, onRender, isPreviewing, isRendering, downloadUrl, errorMessage }: ActionBarProps) {
  const busy = isPreviewing || isRendering;

  return (
    <div className="flex flex-col gap-2 border-t border-cocoa-800 bg-cocoa-900/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-h-[1.25rem] text-xs text-red-400">{errorMessage}</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPreview}
          disabled={busy}
          title="Fast, low-facet 3D compile - like OpenSCAD's Preview"
          className="flex items-center gap-2 rounded-md border border-cocoa-500 px-4 py-2 text-sm font-semibold text-cocoa-100 transition-colors hover:bg-cocoa-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPreviewing && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cocoa-300/40 border-t-cocoa-100" />
          )}
          {isPreviewing ? "Compiling…" : "Quick Preview"}
        </button>
        <button
          type="button"
          onClick={onRender}
          disabled={busy}
          title="Full-quality compile, print-ready - like OpenSCAD's Render"
          className="flex items-center gap-2 rounded-md bg-cocoa-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cocoa-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRendering && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {isRendering ? "Rendering…" : "Full Render"}
        </button>
        <a
          href={downloadUrl ? `${downloadUrl}?download=1` : undefined}
          aria-disabled={!downloadUrl}
          download
          title={downloadUrl ? undefined : "Run a Full Render first"}
          className={`flex items-center rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
            downloadUrl
              ? "border-cocoa-500 text-cocoa-100 hover:bg-cocoa-800"
              : "cursor-not-allowed border-cocoa-800 text-cocoa-600"
          }`}
          onClick={(e) => {
            if (!downloadUrl) e.preventDefault();
          }}
        >
          Download STL
        </a>
      </div>
    </div>
  );
}
