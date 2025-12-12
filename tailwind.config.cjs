const colors = require("tailwindcss/colors")

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,jsx,js}"],
  theme: {
    extend: {
      colors: {
        border: colors.gray[200],
        input: colors.gray[200],
        ring: colors.gray[900],
        background: colors.white,
        foreground: colors.gray[900],
        primary: {
          DEFAULT: colors.blue[600],
          foreground: colors.white,
        },
        secondary: {
          DEFAULT: colors.gray[200],
          foreground: colors.gray[900],
        },
        destructive: {
          DEFAULT: colors.red[600],
          foreground: colors.white,
        },
        muted: {
          DEFAULT: colors.gray[100],
          foreground: colors.gray[500],
        },
        accent: {
          DEFAULT: colors.gray[200],
          foreground: colors.gray[900],
        },
        popover: {
          DEFAULT: colors.white,
          foreground: colors.gray[900],
        },
        card: {
          DEFAULT: colors.white,
          foreground: colors.gray[900],
        },
      },
    },
  },
  plugins: [],
}
