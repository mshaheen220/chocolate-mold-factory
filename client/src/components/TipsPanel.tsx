import { useEffect, useState } from "react";
import { shuffleIndices, TIPS, type TipCategory } from "../tips";

const CATEGORY_LABELS: Record<TipCategory, string> = {
  generating: "Generating",
  slicing: "Slicing",
  printing: "Printing",
};

const CATEGORY_ICONS: Record<TipCategory, string> = {
  generating: "🎛️",
  slicing: "🔪",
  printing: "🖨️",
};

const CATEGORY_BADGE_STYLES: Record<TipCategory, string> = {
  generating: "border-sky-700/60 bg-sky-900/50 text-sky-200",
  slicing: "border-emerald-700/60 bg-emerald-900/50 text-emerald-200",
  printing: "border-amber-700/60 bg-amber-900/50 text-amber-200",
};

const AUTOPLAY_INTERVAL_MS = 6000;

export function TipsPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [order, setOrder] = useState<number[]>(() => shuffleIndices(TIPS.length));
  const [position, setPosition] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  const currentTip = TIPS[order[position]];

  const goNext = () => {
    setPosition((p) => {
      if (p + 1 >= order.length) {
        // Full tour complete - reshuffle for the next lap rather than
        // looping the same order, so it doesn't feel mechanically repetitive.
        setOrder(shuffleIndices(TIPS.length));
        return 0;
      }
      return p + 1;
    });
  };

  const goPrev = () => {
    setPosition((p) => (p - 1 + order.length) % order.length);
  };

  useEffect(() => {
    // Collapsing shouldn't leave the interval quietly advancing a tip
    // nobody can see - pause while closed, resume from wherever it left
    // off once reopened (the autoplay toggle itself is untouched).
    if (!autoplay || !isOpen) return;
    const timer = setInterval(goNext, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, isOpen, order]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-cocoa-700 bg-cocoa-900/60 px-3 py-1.5 text-xs font-medium text-cocoa-300 transition-colors hover:border-cocoa-500 hover:text-cocoa-100"
      >
        <span aria-hidden>💡</span> Tips
      </button>
    );
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-cocoa-800 bg-cocoa-900/60 py-2 pl-3 pr-2">
      <span
        title={CATEGORY_LABELS[currentTip.category]}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${CATEGORY_BADGE_STYLES[currentTip.category]}`}
      >
        <span aria-hidden>{CATEGORY_ICONS[currentTip.category]}</span>
        <span className="sr-only">{CATEGORY_LABELS[currentTip.category]}</span>
      </span>

      {/* min-h reserves space for a full 2 lines (text-xs/leading-relaxed)
          so a short 1-line tip doesn't shrink the bar and shift the header;
          items-center then keeps a short tip vertically centered in that
          reserved space instead of stuck at the top. */}
      <div className="flex min-h-[2.5rem] min-w-0 flex-1 items-center">
        <p key={order[position]} className="line-clamp-2 animate-fade-in text-xs leading-relaxed text-cocoa-200">
          {currentTip.text}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous tip"
          className="rounded px-1.5 py-1 text-sm text-cocoa-400 transition-colors hover:bg-cocoa-800 hover:text-cocoa-100"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next tip"
          className="rounded px-1.5 py-1 text-sm text-cocoa-400 transition-colors hover:bg-cocoa-800 hover:text-cocoa-100"
        >
          ›
        </button>
        <button
          type="button"
          onClick={() => setAutoplay((a) => !a)}
          aria-pressed={autoplay}
          title={autoplay ? "Stop autoplay" : "Autoplay through tips"}
          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
            autoplay ? "bg-cocoa-600 text-white" : "text-cocoa-400 hover:bg-cocoa-800 hover:text-cocoa-100"
          }`}
        >
          {autoplay ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Collapse tips"
          className="rounded px-1.5 py-1 text-sm text-cocoa-400 transition-colors hover:bg-cocoa-800 hover:text-cocoa-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
