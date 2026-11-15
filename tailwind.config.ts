import type { Config } from "tailwindcss";

// Semantic color names backed by the theme tokens in globals.css.
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        sidebar: "var(--color-sidebar)",
        surface: "var(--color-surface)",
        raised: "var(--color-raised)",
        line: "var(--color-line)",
        text: "var(--color-text)",
        heading: "var(--color-heading)",
        accent: "var(--color-accent)",
        muted: "var(--color-muted)",
        control: "var(--color-control)",
        "control-text": "var(--color-control-text)",
      },
    },
  },
  plugins: [],
} satisfies Config;
