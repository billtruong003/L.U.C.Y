/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05070e",
        panel: "#0b1322",
        panel2: "#111c30",
        line: "rgba(127,179,214,0.14)",
        cyan: "#3fd3ff",
        teal: "#35d4c0",
        grn: "#5fe39a",
        pink: "#ff5d9e",
        ink: "#e7f1fb",
        inkdim: "#9fb4c9",
        inkfaint: "#5e748b",
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', "ui-monospace", "monospace"],
        sans: ['Inter', "system-ui", "sans-serif"],
        display: ['Orbitron', "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 22px rgba(63,211,255,0.18)",
        card: "0 8px 28px rgba(0,0,0,0.40)",
      },
    },
  },
  plugins: [],
}
