/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Each shade reads from a CSS variable (see index.css) so the same
        // cocoa-* classes used throughout the app automatically repaint for
        // the light theme instead of needing dark:/light: variants on every
        // usage. <alpha-value> keeps opacity modifiers (e.g. bg-cocoa-900/60)
        // working.
        cocoa: {
          50: "rgb(var(--color-cocoa-50) / <alpha-value>)",
          100: "rgb(var(--color-cocoa-100) / <alpha-value>)",
          200: "rgb(var(--color-cocoa-200) / <alpha-value>)",
          300: "rgb(var(--color-cocoa-300) / <alpha-value>)",
          400: "rgb(var(--color-cocoa-400) / <alpha-value>)",
          500: "rgb(var(--color-cocoa-500) / <alpha-value>)",
          600: "rgb(var(--color-cocoa-600) / <alpha-value>)",
          700: "rgb(var(--color-cocoa-700) / <alpha-value>)",
          800: "rgb(var(--color-cocoa-800) / <alpha-value>)",
          900: "rgb(var(--color-cocoa-900) / <alpha-value>)",
          950: "rgb(var(--color-cocoa-950) / <alpha-value>)",
        },
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        drip: {
          "0%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "50%": { transform: "translateY(7px)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        drip: "drip 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
