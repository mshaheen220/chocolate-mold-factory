import { type ReactNode, useState } from "react";

interface ParameterCardProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function ParameterCard({ title, defaultOpen = true, children }: ParameterCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-cocoa-800 bg-cocoa-900/60">
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
