const colors = require("tailwindcss/colors")

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,jsx,js}"],
  theme: {
    extend: {
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

        // Extra palette helpers used by the screens.
        "background-light": "#f7f6f8",
        "background-dark": "#191022",
        "surface-dark": "#2a2136",
        "surface-light": "#ffffff",
        "surface-input": "#362348",
        "text-secondary": "#ab9db9",
        "primary-rich": "#6a0cd8",
        "text-light": "#e0e0e0",
        "text-dark": "#a0a0b0",
        "bubble-incoming": "#322b3c",
      },
    },
  },
  plugins: [],
}
