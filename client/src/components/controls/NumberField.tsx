interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function NumberField({ label, value, min, max, step, unit, onChange }: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-cocoa-200">
        <span>{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
            className="w-16 rounded border border-cocoa-700 bg-cocoa-900 px-1.5 py-0.5 text-right text-xs text-cocoa-100 focus:border-cocoa-400 focus:outline-none"
          />
          {unit && <span className="text-cocoa-400">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-cocoa-400"
      />
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
