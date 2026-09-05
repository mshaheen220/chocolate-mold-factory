interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-xs font-medium text-cocoa-200">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-cocoa-600 bg-cocoa-900 accent-cocoa-400"
      />
    </label>
  );
}
