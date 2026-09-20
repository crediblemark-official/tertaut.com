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
      fontSize: {
        '3xs': ['8px', { lineHeight: '11px' }],
        '2xs': ['10px', { lineHeight: '14px' }],
      },
      zIndex: {
        sticky: '40',
        nav: '50',
        drawer: '60',
        backdrop: '70',
        modal: '80',
        popover: '90',
        toast: '100',
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(17, 17, 17, 0.03)',
        'xs': '0 1px 2px 0 rgba(17, 17, 17, 0.05)',
        'card': '0 2px 8px -1px rgba(17, 17, 17, 0.04), 0 1px 3px -1px rgba(17, 17, 17, 0.02)',
        'card-hover': '0 8px 24px -4px rgba(17, 17, 17, 0.08)',
        'card-dark': '0 10px 30px -5px rgba(17, 17, 17, 0.25)',
        'luxury': '0 4px 20px -2px rgba(17, 17, 17, 0.06), 0 2px 6px -1px rgba(17, 17, 17, 0.04)',
        'luxury-hover': '0 12px 32px -4px rgba(17, 17, 17, 0.12), 0 4px 12px -2px rgba(17, 17, 17, 0.06)',
        'gold-glow': '0 4px 16px rgba(212, 175, 55, 0.35)',
        'gold-glow-lg': '0 6px 20px rgba(212, 175, 55, 0.45)',
        'forest-glow': '0 4px 16px rgba(15, 76, 58, 0.25)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      scale: {
        '98': '0.98',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        scaleIn: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};