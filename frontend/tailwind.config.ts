import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#070B1A",
          50: "#f4f6fb",
          100: "#e6eaf6",
          200: "#c5cde6",
          300: "#8b97c0",
          400: "#5b6794",
          500: "#3d4873",
          600: "#2b355c",
          700: "#1e2748",
          800: "#141b34",
          900: "#0B1224",
          950: "#070B1A",
        },
        // Primary brand: indigo / electric blue
        sentinel: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#7C8FFF",
          500: "#4F6BFF",
          600: "#3D56E8",
          700: "#3347C7",
          800: "#2B3BA0",
          900: "#28347D",
          950: "#1A2154",
        },
        violet: {
          DEFAULT: "#8B5CF6",
          soft: "#C4B5FD",
          deep: "#6D28D9",
        },
        mint: {
          DEFAULT: "#8B5CF6",
          soft: "#C4B5FD",
          deep: "#6D28D9",
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
          clear: "#7C8FFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 48px rgba(79, 107, 255, 0.32)",
        "glow-amber": "0 0 36px rgba(245, 158, 11, 0.25)",
        "glow-rose": "0 0 36px rgba(244, 63, 94, 0.22)",
        "glow-violet": "0 0 36px rgba(139, 92, 246, 0.28)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.45)",
        ring: "0 0 0 3px rgba(79, 107, 255, 0.35)",
        nav: "0 0 24px rgba(79, 107, 255, 0.14)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to right, rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.05) 1px, transparent 1px)",
        "mint-sheen":
          "linear-gradient(135deg, rgba(79,107,255,0.20) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)",
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
