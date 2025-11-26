/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,jsx,js}"],
  theme: {
    extend: {
      colors: {
        // Core backgrounds
        "mn-bg": "#020617",
        "mn-bg-elevated": "#05081a",

        // Brand primaries
        "mn-primary": "#f97316",
        "mn-primary-soft": "#fed7aa",

        // Accents
        "mn-accent-teal": "#14b8a6",
        "mn-accent-violet": "#a855f7",

        // Text
        "mn-text-primary": "#e5e7eb",
        "mn-text-secondary": "#9ca3af",
        "mn-text-muted": "#6b7280",

        // Borders
        "mn-border-subtle": "#1f2937",
        "mn-border-strong": "#4b5563",

        // Status
        "mn-success": "#22c55e",
        "mn-warning": "#facc15",
        "mn-error": "#f97373",
      },
      fontFamily: {
        ui: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        heading: ['"Space Grotesk"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      backgroundImage: {
        "mn-hero":
          "linear-gradient(135deg, #a855f7 0%, #22c55e 40%, #f97316 100%)",
      },
      boxShadow: {
        "mn-soft": "0 18px 45px rgba(15, 23, 42, 0.75)",
        "mn-card": "0 14px 35px rgba(15, 23, 42, 0.9)",
      },
      borderRadius: {
        "mn-card": "1.5rem",
      },
    },
  },
  plugins: [],
};
