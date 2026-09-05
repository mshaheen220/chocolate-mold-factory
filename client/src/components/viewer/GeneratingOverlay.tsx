import { useEffect, useState } from "react";
import { pickRandomTipIndex, TIPS } from "../../tips";

interface GeneratingOverlayProps {
  quality: "draft" | "final";
}

const TIP_INTERVAL_MS = 6200;

export function GeneratingOverlay({ quality }: GeneratingOverlayProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [tipIndex, setTipIndex] = useState(() => pickRandomTipIndex());

  // Elapsed-time counter resets whenever a new compile starts (quality can
  // flip between draft/final without the overlay unmounting).
  useEffect(() => {
    const start = Date.now();
    setElapsedMs(0);
    const timer = setInterval(() => setElapsedMs(Date.now() - start), 100);
    return () => clearInterval(timer);
  }, [quality]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((current) => pickRandomTipIndex(current));
    }, TIP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-cocoa-950/98 backdrop-blur-md">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-cocoa-700 border-t-cocoa-300" />
          <span className="text-4xl">🍫</span>
        </div>
        <div className="flex gap-1.5">
          {[0, 0.2, 0.4].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 rounded-full bg-cocoa-300 animate-drip"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-white">
          {quality === "draft"
            ? "Compiling quick preview…"
            : "Running full-quality render…"}
        </p>
        <p className="mt-1 text-xs tabular-nums text-cocoa-200">
          {(elapsedMs / 1000).toFixed(1)}s elapsed
        </p>
      </div>

      <div
        key={tipIndex}
        className="max-w-sm animate-fade-in rounded-lg border border-cocoa-700 bg-cocoa-900 px-4 py-3 text-center text-xs leading-relaxed text-cocoa-100 shadow-lg"
      >
        <span className="font-semibold text-white">Tip: </span>
        {TIPS[tipIndex].text}
      </div>
    </div>
  );
}
