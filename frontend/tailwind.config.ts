import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#070c0b",
          50: "#f3f7f6",
          100: "#e4eeec",
          200: "#c5d9d4",
          300: "#95b8b0",
          400: "#5f8f85",
          500: "#3f6d65",
          600: "#2f554f",
          700: "#264440",
          800: "#1c3230",
          900: "#122220",
          950: "#070c0b",
        },
        // Primary brand: electric teal / mint (fintech, not purple sludge)
        sentinel: {
          50: "#edfffa",
          100: "#d5fff5",
          200: "#aeffeb",
          300: "#70ffe0",
          400: "#2ef5cb",
          500: "#0dd4b0",
          600: "#00ab91",
          700: "#048976",
          800: "#096c5f",
          900: "#0c594f",
          950: "#00332e",
        },
        mint: {
          DEFAULT: "#5eead4",
          soft: "#99f6e4",
          deep: "#0f766e",
        },
        amber: {
          soft: "#fbbf24",
          glow: "#f59e0b",
        },
        rose: {
          soft: "#fb7185",
          glow: "#f43f5e",
        },
        rail: {
          healthy: "#34d399",
          degraded: "#fbbf24",
          blocked: "#fb7185",
          clear: "#2dd4bf",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 48px rgba(13, 212, 176, 0.28)",
        "glow-amber": "0 0 36px rgba(245, 158, 11, 0.25)",
        "glow-rose": "0 0 36px rgba(244, 63, 94, 0.22)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.4)",
        ring: "0 0 0 3px rgba(13, 212, 176, 0.35)",
        nav: "0 0 24px rgba(13, 212, 176, 0.12)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to right, rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.05) 1px, transparent 1px)",
        "mint-sheen":
          "linear-gradient(135deg, rgba(13,212,176,0.18) 0%, rgba(45,212,191,0.06) 40%, transparent 70%)",
      },
      backgroundSize: {
        grid: "48px 48px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "float-y": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "bubble-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "float-y": "float-y 4s ease-in-out infinite",
        "bubble-in": "bubble-in 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
