import type { Config } from "tailwindcss";

/**
 * Every semantic color, radius, and shadow below resolves to a Matisse design
 * token (matisse-tokens-all.css). Components must use these classes instead of
 * hard-coding values so the three screens stay visually consistent.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary-color)",
          container: "var(--color-primary-container-color)",
          "on-container": "var(--color-on-primary-container-color)",
        },
        "on-primary": "var(--color-on-primary-color)",
        secondary: {
          DEFAULT: "var(--color-secondary-color)",
          container: "var(--color-secondary-container-color)",
          "on-container": "var(--color-on-secondary-container-color)",
        },
        "on-secondary": "var(--color-on-secondary-color)",
        background: "var(--color-background-color)",
        "on-background": "var(--color-on-background-color)",
        surface: "var(--color-surface-color)",
        "surface-variant": "var(--color-surface-variant-color)",
        "on-surface": "var(--color-on-surface-color)",
        "on-surface-variant": "var(--color-on-surface-variant-color)",
        outline: "var(--color-outline-color)",
        "outline-variant": "var(--color-outline-variant-color)",
        "inverse-surface": "var(--color-inverse-surface-color)",
        "inverse-on-surface": "var(--color-inverse-on-surface-color)",
        "container-lowest": "var(--color-surface-container-lowest-color)",
        "container-low": "var(--color-surface-container-low-color)",
        container: "var(--color-surface-container-color)",
        "container-high": "var(--color-surface-container-high-color)",
        "container-highest": "var(--color-surface-container-highest-color)",
        warning: {
          surface: "var(--status-warning-surface)",
          text: "var(--status-warning-text)",
          border: "var(--status-warning-border)",
        },
        info: {
          surface: "var(--status-info-surface)",
          text: "var(--status-info-text)",
          border: "var(--status-info-border)",
        },
        success: {
          surface: "var(--status-success-surface)",
          text: "var(--status-success-text)",
          border: "var(--status-success-border)",
        },
        danger: {
          surface: "var(--status-error-surface)",
          text: "var(--status-error-text)",
          border: "var(--status-error-border)",
        },
      },
      borderRadius: {
        "token-sm": "var(--border-radius-radius-sm)",
        "token-md": "var(--border-radius-radius-md)",
        "token-lg": "var(--border-radius-radius-lg)",
        "token-xl": "var(--border-radius-radius-xl)",
        "token-2xl": "var(--border-radius-radius-2xl)",
        "token-full": "var(--border-radius-radius-full)",
      },
      boxShadow: {
        "token-xs": "var(--shadows-shadow-xs)",
        "token-sm": "var(--shadows-shadow-sm)",
        "token-md": "var(--shadows-shadow-md)",
        "token-lg": "var(--shadows-shadow-lg)",
        "token-xl": "var(--shadows-shadow-xl)",
        "token-2xl": "var(--shadows-shadow-2xl)",
      },
      fontFamily: {
        sans: [
          "var(--typography-font-family-sans)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "var(--typography-font-family-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
