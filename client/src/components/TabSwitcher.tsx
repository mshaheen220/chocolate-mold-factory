import type { Workflow } from "../types";

interface TabSwitcherProps {
  workflow: Workflow;
  onChange: (workflow: Workflow) => void;
}

const tabs: { value: Workflow; label: string }[] = [
  { value: "medallion", label: "2D Graphic → Chocolate Tokens" },
  { value: "mold_box", label: "Reusable Silicone Mold Box" },
];

export function TabSwitcher({ workflow, onChange }: TabSwitcherProps) {
  return (
    <div className="flex rounded-lg border border-cocoa-800 bg-cocoa-900/60 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
            workflow === tab.value
              ? "bg-cocoa-600 text-white shadow"
              : "text-cocoa-300 hover:bg-cocoa-800/60"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
