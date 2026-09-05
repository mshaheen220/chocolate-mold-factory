interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-cocoa-200">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-cocoa-700 bg-cocoa-900 px-2 py-1.5 text-sm text-cocoa-100 focus:border-cocoa-400 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
