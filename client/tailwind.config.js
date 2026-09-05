/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cocoa: {
          50: "#fbf5f0",
          100: "#f2e3d5",
          200: "#e2c3a8",
          300: "#cf9c74",
          400: "#bc7a4d",
          500: "#a5602f",
          600: "#8a4c26",
          700: "#6f3c22",
          800: "#4a2a1c",
          900: "#2c1a12",
          950: "#180d08",
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
