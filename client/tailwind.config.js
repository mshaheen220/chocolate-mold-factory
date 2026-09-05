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
    },
  },
  plugins: [],
};
