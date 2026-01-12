const colors = require("tailwindcss/colors")

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,jsx,js}"],
  theme: {
    extend: {
      fontFamily: {
        heading: [
          "Spline Sans",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
        body: [
          "Spline Sans",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.9375rem", { lineHeight: "1.5rem" }],
        lg: ["1.0625rem", { lineHeight: "1.6rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
      },
      colors: {
        // Global theme (dark + purple accent) to match the new swipe page.
        border: "#2d1f3b",
        input: "#2d1f3b",
        ring: "#7f13ec",
        background: "#191022",
        foreground: colors.slate[50],
        primary: {
          DEFAULT: "#7f13ec",
          foreground: colors.white,
        },
        secondary: {
          DEFAULT: "#261933",
          foreground: colors.slate[50],
        },
        destructive: {
          DEFAULT: colors.red[600],
          foreground: colors.white,
        },
        muted: {
          DEFAULT: "#23152f",
          foreground: "#b3a9c3",
        },
        accent: {
          DEFAULT: "#23152f",
          foreground: colors.slate[50],
        },
        popover: {
          DEFAULT: "#261933",
          foreground: colors.slate[50],
        },
        card: {
          DEFAULT: "#261933",
          foreground: colors.slate[50],
        },

        // Extra palette helpers used by the swipe mock.
        "background-light": "#f7f6f8",
        "background-dark": "#191022",
      },
    },
  },
  plugins: [],
}
