/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#04060f",
        panel: "#0a1020",
        cyan: "#3fd3ff",
        pink: "#ff2d7e",
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
}
