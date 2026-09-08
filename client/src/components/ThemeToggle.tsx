import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className="flex shrink-0 items-center justify-center rounded-md border border-cocoa-700 bg-cocoa-900/60 px-2.5 py-1.5 text-sm text-cocoa-300 transition-colors hover:border-cocoa-500 hover:text-cocoa-100"
    >
      <span aria-hidden>{isLight ? "☀️" : "🌙"}</span>
    </button>
  );
}
