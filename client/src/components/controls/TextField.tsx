interface TextFieldProps {
  label: string;
  value: string;
  maxLength: number;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function TextField({ label, value, maxLength, placeholder, onChange }: TextFieldProps) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-cocoa-200">
        <span>{label}</span>
        <span className="text-cocoa-500">
          {value.length}/{maxLength}
        </span>
      </div>
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-cocoa-700 bg-cocoa-900 px-2 py-1.5 text-sm text-cocoa-100 placeholder:text-cocoa-500 focus:border-cocoa-400 focus:outline-none"
      />
    </label>
  );
}
