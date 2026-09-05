import { useCallback, useRef, useState } from "react";

interface FileDropzoneProps {
  accept: string;
  label: string;
  file: File | null;
  previewUrl: string | null;
  onFile: (file: File | null) => void;
}

export function FileDropzone({ accept, label, file, previewUrl, onFile }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptedExtensions = accept.split(",").map((e) => e.trim().toLowerCase());

  const acceptFile = useCallback(
    (candidate: File | undefined | null) => {
      if (!candidate) return;
      const ext = `.${candidate.name.split(".").pop()?.toLowerCase()}`;
      if (!acceptedExtensions.includes(ext)) return;
      onFile(candidate);
    },
    [acceptedExtensions, onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        acceptFile(e.dataTransfer.files[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 px-4 py-4 text-center transition-colors ${
        isDragging
          ? "border-dashed border-cocoa-400 bg-cocoa-800/50"
          : file
            ? "border-solid border-emerald-600/70 bg-emerald-950/20 hover:border-emerald-500"
            : "border-dashed border-cocoa-700 bg-cocoa-900/40 hover:border-cocoa-500"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />

      {file && previewUrl ? (
        <>
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-emerald-950 shadow">
            ✓
          </span>
          <div className="flex h-20 w-20 items-center justify-center rounded-md border border-emerald-700/50 bg-white/90 p-1.5">
            <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
          </div>
          <span className="max-w-full truncate text-xs font-medium text-emerald-200">{file.name}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-xs text-cocoa-400 underline hover:text-cocoa-200"
          >
            Remove file
          </button>
        </>
      ) : (
        <>
          <span className="text-sm font-medium text-cocoa-200">{label}</span>
          <span className="text-xs text-cocoa-400">Drag & drop or click to browse ({accept})</span>
        </>
      )}
    </div>
  );
}
