import type { Config } from "tailwindcss";

const ink = {
  DEFAULT: "#121014",
  50: "#F3EEE8",
  100: "#E8E1D8",
  200: "#D4CBC0",
  300: "#A79F98",
  400: "#8A827A",
  500: "#5C564F",
  600: "#3A3438",
  700: "#2A2430",
  800: "#1C181F",
  900: "#161218",
  950: "#121014",
};

const saffron = {
  50: "#FFF8EB",
  100: "#FFEFCC",
  200: "#FFD88A",
  300: "#FFC45A",
  400: "#FFB940",
  500: "#F5A524",
  600: "#D48A14",
  700: "#A86A10",
  800: "#7A4D0C",
  900: "#533409",
  950: "#2C1B05",
};

const danger = {
  50: "#FDECEC",
  100: "#FAD6D7",
  200: "#F5B0B2",
  300: "#EE7E82",
  400: "#E85C61",
  500: "#E5484D",
  600: "#C43338",
  700: "#9F282C",
  800: "#751E21",
  900: "#4E1416",
  950: "#2A0B0C",
};

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Remap cool Tailwind palettes so no leftover class ships blue/green.
        slate: ink,
        zinc: ink,
        neutral: ink,
        stone: ink,
        gray: ink,
        ink,
        // Primary brand: amber / saffron
        sentinel: saffron,
        amber: {
          ...saffron,
          DEFAULT: "#F5A524",
          soft: "#FFC45A",
          glow: "#FFB940",
        },
        plum: {
          DEFAULT: "#B07CC6",
          soft: "#C9A0D8",
          deep: "#8A5A9E",
          200: "#C9A0D8",
          300: "#C49AD6",
          400: "#B07CC6",
          500: "#B07CC6",
          600: "#8A5A9E",
        },
        coral: {
          DEFAULT: "#FF6B4A",
          soft: "#FF8A70",
          deep: "#E24E2F",
          200: "#FFB0A0",
          300: "#FF8A70",
          400: "#FF6B4A",
          500: "#FF6B4A",
          600: "#E24E2F",
          900: "#6B2418",
        },
        rose: {
          ...danger,
          DEFAULT: "#E5484D",
          soft: "#EE7E82",
          glow: "#E5484D",
        },
        rail: {
          healthy: "#F5A524",
          degraded: "#FF6B4A",
          blocked: "#E5484D",
          clear: "#B07CC6",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 48px rgba(245, 165, 36, 0.32)",
        "glow-amber": "0 0 36px rgba(245, 165, 36, 0.28)",
        "glow-rose": "0 0 36px rgba(229, 72, 77, 0.22)",
        "glow-plum": "0 0 36px rgba(176, 124, 198, 0.24)",
        "glow-coral": "0 0 36px rgba(255, 107, 74, 0.24)",
        card: "0 1px 0 rgba(243,238,232,0.04) inset, 0 8px 32px rgba(0,0,0,0.45)",
        ring: "0 0 0 3px rgba(245, 165, 36, 0.35)",
        nav: "0 0 24px rgba(245, 165, 36, 0.12)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to right, rgba(167,159,152,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(167,159,152,0.07) 1px, transparent 1px)",
        "accent-sheen":
          "linear-gradient(135deg, rgba(245,165,36,0.20) 0%, rgba(176,124,198,0.08) 40%, transparent 70%)",
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
