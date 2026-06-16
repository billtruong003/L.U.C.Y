/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05070e",
        panel: "#0b1322",
        panel2: "#111c30",
        line: "rgba(127,179,214,0.22)",        /* W2.A: viền rõ hơn để tách card/cột */
        cyan: "#3fd3ff",
        teal: "#35d4c0",
        grn: "#5fe39a",
        pink: "#ff5d9e",
        gold: "#f5b54a",                        /* T1/U0 Jarvis: Iron-Man warm — live/thị trường/tiền */
        rose: "#fb7185",                         /* T1/U0: danger rose */
        ink: "#e7f1fb",
        inkdim: "#9fb4c9",
        inkfaint: "#7589a0",                    /* W2.A: nâng từ #5e748b → đạt WCAG AA (~5:1) cho chữ phụ nhỏ */
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', "ui-monospace", "monospace"],
        num: ['"JetBrains Mono"', "ui-monospace", "monospace"],  /* T1/U0: số/token/data */
        sans: ['Inter', "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 22px rgba(63,211,255,0.18)",
        "glow-gold": "0 0 22px rgba(245,181,74,0.20)",
        card: "0 8px 28px rgba(0,0,0,0.40)",
      },
    },
  },
  plugins: [],
}
