import type { Config } from "tailwindcss";

const ink = {
  DEFAULT: "#FFFFFF",
  50: "#F6F8FA",
  100: "#EAEEF2",
  200: "#D0D7DE",
  300: "#8C959F",
  400: "#656D76",
  500: "#656D76",
  600: "#1F2328",
  700: "#1F2328",
  800: "#1F2328",
  900: "#1F2328",
  950: "#1F2328",
};

const brand = {
  50: "#DAFBE1",
  100: "#ACEEBB",
  200: "#6FDD8B",
  300: "#3FB950",
  400: "#2DA44E",
  500: "#1F883D",
  600: "#1A7F37",
  700: "#116329",
  800: "#044F1E",
  900: "#003D16",
  950: "#002D11",
};

const danger = {
  50: "#FFEBE9",
  100: "#FFCECB",
  200: "#FFABA8",
  300: "#FF8182",
  400: "#FA4549",
  500: "#CF222E",
  600: "#A40E26",
  700: "#A40E26",
  800: "#8D151E",
  900: "#6D1219",
  950: "#4C0C12",
};

const warn = {
  50: "#FFF8C5",
  100: "#FAE17D",
  200: "#D4A72C",
  300: "#BF8700",
  400: "#9A6700",
  500: "#9A6700",
  600: "#7D4E00",
  700: "#633C01",
  800: "#4D2D00",
  900: "#3B2300",
  950: "#2D1B00",
};

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: ink,
        zinc: ink,
        neutral: ink,
        stone: ink,
        gray: ink,
        ink,
        fg: {
          DEFAULT: "#1F2328",
          muted: "#656D76",
          subtle: "#8C959F",
        },
        surface: {
          DEFAULT: "#F6F8FA",
          canvas: "#FFFFFF",
        },
        line: {
          DEFAULT: "#D0D7DE",
        },
        // Primary brand: GitHub-style CTA green
        sentinel: brand,
        link: {
          DEFAULT: "#0969DA",
          bright: "#218BFF",
          50: "#DDF4FF",
          100: "#B6E3FF",
          200: "#80CCFF",
          300: "#54AEFF",
          400: "#218BFF",
          500: "#0969DA",
          600: "#0550AE",
          700: "#033D8B",
          800: "#0A3069",
          900: "#002155",
        },
        lavender: {
          DEFAULT: "#8250DF",
          bright: "#A475F9",
          soft: "#A475F9",
          deep: "#8250DF",
          50: "#FBEFFF",
          100: "#ECD8FF",
          200: "#D8B9FF",
          300: "#C297FF",
          400: "#A475F9",
          500: "#8250DF",
          600: "#6639BA",
          700: "#512A9F",
          800: "#3C1E7A",
          900: "#271052",
        },
        plum: {
          DEFAULT: "#8250DF",
          soft: "#A475F9",
          deep: "#6639BA",
          200: "#D8B9FF",
          300: "#8250DF",
          400: "#8250DF",
          500: "#8250DF",
          600: "#6639BA",
        },
        amber: {
          ...warn,
          DEFAULT: "#9A6700",
          soft: "#BF8700",
          glow: "#BF8700",
        },
        coral: {
          DEFAULT: "#9A6700",
          soft: "#BF8700",
          deep: "#7D4E00",
          200: "#FAE17D",
          300: "#9A6700",
          400: "#9A6700",
          500: "#9A6700",
          600: "#7D4E00",
          900: "#3B2300",
        },
        rose: {
          ...danger,
          DEFAULT: "#CF222E",
          soft: "#FA4549",
          glow: "#CF222E",
        },
        rail: {
          healthy: "#1F883D",
          degraded: "#9A6700",
          blocked: "#CF222E",
          clear: "#0969DA",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 8px 24px rgba(31, 136, 61, 0.18)",
        "glow-amber": "0 8px 24px rgba(154, 103, 0, 0.16)",
        "glow-rose": "0 8px 24px rgba(207, 34, 46, 0.16)",
        "glow-plum": "0 8px 24px rgba(130, 80, 223, 0.16)",
        "glow-coral": "0 8px 24px rgba(154, 103, 0, 0.16)",
        card: "0 1px 0 rgba(31, 35, 40, 0.04), 0 1px 3px rgba(31, 35, 40, 0.08)",
        ring: "0 0 0 3px rgba(9, 105, 218, 0.28)",
        nav: "0 1px 0 rgba(208, 215, 222, 1)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to right, rgba(208,215,222,0.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(208,215,222,0.7) 1px, transparent 1px)",
        "accent-sheen":
          "linear-gradient(135deg, rgba(9,105,218,0.12) 0%, rgba(45,164,78,0.10) 40%, transparent 70%)",
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
