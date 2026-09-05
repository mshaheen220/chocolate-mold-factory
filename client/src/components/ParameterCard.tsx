import { type ReactNode, useState } from "react";

interface ParameterCardProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function ParameterCard({ title, defaultOpen = true, children }: ParameterCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    // shrink-0: this card's overflow-hidden zeroes its flexbox automatic
    // minimum size (per spec), so as a *direct* child of a bounded flex
    // column (e.g. the sidebar's outer scroll container) it would get
    // crushed to ~0 height by flex-shrink instead of the container
    // scrolling. shrink-0 opts it out of that shrinkage unconditionally.
    <div className="shrink-0 overflow-hidden rounded-lg border border-cocoa-800 bg-cocoa-900/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-cocoa-100 hover:bg-cocoa-800/40"
      >
        {title}
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && <div className="space-y-4 border-t border-cocoa-800 px-3 py-3">{children}</div>}
    </div>
  );
}
