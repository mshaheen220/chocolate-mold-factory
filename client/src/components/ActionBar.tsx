import { useRef } from "react";

interface ActionBarProps {
  onSaveSettings: (fileName: string) => void;
  onImportSettings: (file: File) => void;
  onPreview: () => void;
  onRender: () => void;
  isPreviewing: boolean;
  isRendering: boolean;
  downloadUrl: string | null;
  errorMessage: string | null;
  fileName: string;
  onFileNameChange: (name: string) => void;
}

function Spinner({ className }: { className: string }) {
  return <span className={`animate-spin rounded-full border-2 border-current/40 border-t-current ${className}`} />;
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h11l3 3v13H5V4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4v5h8V4" />
      <rect x="8" y="13" width="8" height="6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12S6 5 12 5s9.75 7 9.75 7-3.75 7-9.75 7-9.75-7-9.75-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v9M12 12l8-4.5M12 12L4 7.5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3m0 0l-4 4m4-4l4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
    </svg>
  );
}

export function ActionBar({
  onSaveSettings,
  onImportSettings,
  onPreview,
  onRender,
  isPreviewing,
  isRendering,
  downloadUrl,
  errorMessage,
  fileName,
  onFileNameChange,
}: ActionBarProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const busy = isPreviewing || isRendering;
  const trimmedName = fileName.trim();
  const downloadFileName = trimmedName ? (trimmedName.toLowerCase().endsWith(".stl") ? trimmedName : `${trimmedName}.stl`) : undefined;
  // The `download` attribute alone isn't enough: the server's response sets
  // its own Content-Disposition filename (see server/src/routes/output.ts),
  // which browsers prefer over this attribute for a same-origin navigation.
  // Passing it as `?name=` lets the server echo the chosen name back.
  const downloadHref = downloadUrl
    ? `${downloadUrl}?download=1${downloadFileName ? `&name=${encodeURIComponent(downloadFileName)}` : ""}`
    : undefined;

  return (
    <div className="flex flex-col gap-2 border-t border-cocoa-800 bg-cocoa-900/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-h-[1.25rem] text-xs text-red-400">{errorMessage}</div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={fileName}
          onChange={(e) => onFileNameChange(e.target.value)}
          placeholder="File name (optional)"
          aria-label="Download file name"
          className="w-40 rounded-md border border-cocoa-700 bg-cocoa-950 px-2 py-2 text-sm text-cocoa-100 placeholder:text-cocoa-500 focus:border-cocoa-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onSaveSettings(trimmedName)}
          title="Save Settings - download the current parameters as a JSON file"
          aria-label="Save Settings"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-cocoa-700 text-cocoa-300 transition-colors hover:border-cocoa-500 hover:text-cocoa-100"
        >
          <SaveIcon />
        </button>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          title="Import Settings - load parameters from a previously saved JSON file"
          aria-label="Import Settings"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-cocoa-700 text-cocoa-300 transition-colors hover:border-cocoa-500 hover:text-cocoa-100"
        >
          <UploadIcon />
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportSettings(file);
            e.target.value = "";
          }}
        />

        <span className="mx-1 h-6 w-px bg-cocoa-800" aria-hidden="true" />

        <button
          type="button"
          onClick={onPreview}
          disabled={busy}
          title={isPreviewing ? "Compiling…" : "Quick Preview - fast, low-facet 3D compile, like OpenSCAD's Preview"}
          aria-label="Quick Preview"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-cocoa-500 text-cocoa-100 transition-colors hover:bg-cocoa-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPreviewing ? <Spinner className="h-4 w-4 text-cocoa-100" /> : <EyeIcon />}
        </button>
        <button
          type="button"
          onClick={onRender}
          disabled={busy}
          title={isRendering ? "Rendering…" : "Full Render - full-quality compile, print-ready, like OpenSCAD's Render"}
          aria-label="Full Render"
          className="flex h-10 w-10 items-center justify-center rounded-md bg-cocoa-500 text-white transition-colors hover:bg-cocoa-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRendering ? <Spinner className="h-4 w-4 text-white" /> : <CubeIcon />}
        </button>
        <a
          href={downloadHref}
          aria-disabled={!downloadUrl}
          download={downloadFileName ?? true}
          title={downloadUrl ? "Download STL" : "Download STL - run a Full Render first"}
          aria-label="Download STL"
          className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
            downloadUrl
              ? "border-cocoa-500 text-cocoa-100 hover:bg-cocoa-800"
              : "cursor-not-allowed border-cocoa-800 text-cocoa-600"
          }`}
          onClick={(e) => {
            if (!downloadUrl) e.preventDefault();
          }}
        >
          <DownloadIcon />
        </a>
      </div>
    </div>
  );
}
