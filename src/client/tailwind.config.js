import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    resolve(__dirname, "index.html"),
    resolve(__dirname, "src/**/*.{vue,js,ts,jsx,tsx}"),
  ],
  corePlugins: {
    preflight: false,
    float: false,
    opacity: false,
    visibility: false,
    zIndex: false,
    inset: false,
    aspectRatio: false,
    order: false,
    flexBasis: false,
    placeContent: false,
    placeItems: false,
    placeSelf: false,
    alignContent: false,
    justifyItems: false,
    justifySelf: false,
    gap: false,
    all: false,
  },
  theme: {
    extend: {
      colors: {
        jetblack: {
          DEFAULT: "#111111",
          hover: "#222222",
          surface: "#1A1A1A",
          muted: "#666666",
          subtle: "rgba(17, 17, 17, 0.08)",
          border: "rgba(17, 17, 17, 0.12)",
        },
        gold: {
          DEFAULT: "#D4AF37",
          muted: "#C5A059",
          hover: "#B89628",
          light: "#FDFBF7",
          surface: "rgba(212, 175, 55, 0.12)",
          border: "rgba(212, 175, 55, 0.35)",
        },
        forest: {
          DEFAULT: "#0F4C3A",
          hover: "#0B382B",
          light: "#F0F7F4",
          surface: "rgba(15, 76, 58, 0.1)",
          border: "rgba(15, 76, 58, 0.25)",
        },
        crimson: {
          DEFAULT: "#8B0000",
          hover: "#730000",
          light: "#FDF2F2",
          surface: "rgba(139, 0, 0, 0.08)",
          border: "rgba(139, 0, 0, 0.25)",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        'luxury': '0 4px 20px -2px rgba(17, 17, 17, 0.06), 0 2px 6px -1px rgba(17, 17, 17, 0.04)',
        'luxury-hover': '0 12px 32px -4px rgba(17, 17, 17, 0.12), 0 4px 12px -2px rgba(17, 17, 17, 0.06)',
        'gold-glow': '0 4px 16px rgba(212, 175, 55, 0.35)',
        'forest-glow': '0 4px 16px rgba(15, 76, 58, 0.25)',
      },
    },
  },
  plugins: [],
};
