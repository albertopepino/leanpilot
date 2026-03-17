import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      tablet: "900px",   // Tablet landscape breakpoint
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#1e1b4b",
        },
        lean: {
          green: "#10b981",
          yellow: "#f59e0b",
          red: "#ef4444",
          blue: "#3b82f6",
          purple: "#8b5cf6",
          teal: "#14b8a6",
          orange: "#f97316",
          pink: "#ec4899",
        },
        surface: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
        },
        th: {
          bg: "var(--bg-primary)",
          "bg-2": "var(--bg-secondary)",
          "bg-3": "var(--bg-tertiary)",
          "bg-hover": "var(--bg-hover)",
          text: "var(--text-primary)",
          "text-2": "var(--text-secondary)",
          "text-3": "var(--text-tertiary)",
          border: "var(--border-primary)",
          "border-2": "var(--border-secondary)",
          card: "var(--card-bg)",
          "card-border": "var(--card-border)",
          input: "var(--input-bg)",
          "input-border": "var(--input-border)",
          "input-focus": "var(--input-focus)",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-brand": "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)",
        "gradient-success": "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)",
        "gradient-warning": "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
        "gradient-danger": "linear-gradient(135deg, #ef4444 0%, #ec4899 100%)",
        "gradient-cool": "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
      },
      boxShadow: {
        glow: "0 0 20px rgba(99, 102, 241, 0.15)",
        "glow-green": "0 0 20px rgba(16, 185, 129, 0.2)",
        "glow-red": "0 0 20px rgba(239, 68, 68, 0.2)",
        card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
        "card-hover": "0 10px 25px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04)",
      },
      keyframes: {
        "slide-in": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "count-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(16, 185, 129, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(16, 185, 129, 0.4)" },
        },
        "glow-pulse-amber": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(245, 158, 11, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(245, 158, 11, 0.4)" },
        },
        "glow-pulse-red": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(244, 63, 94, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(244, 63, 94, 0.4)" },
        },
        "gauge-appear": {
          "0%": { strokeDashoffset: "var(--gauge-circumference)" },
          "100%": { strokeDashoffset: "var(--gauge-offset)" },
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-sm": "bounce 1s ease-in-out 3",
        "slide-in": "slide-in 0.3s ease-out",
        "count-up": "count-up 0.6s ease-out forwards",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "glow-pulse-amber": "glow-pulse-amber 3s ease-in-out infinite",
        "glow-pulse-red": "glow-pulse-red 3s ease-in-out infinite",
        "gauge-appear": "gauge-appear 1.2s ease-out forwards",
      },
    },
  },
  plugins: [],
};
export default config;
