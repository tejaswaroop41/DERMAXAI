/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  theme: {
    extend: {

      fontFamily: {
        sans: ["Syne", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },

      colors: {

        dx: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },

        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
        background: "#0f172a",
        surface: "#1e293b",
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },

      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.15)",
        card: "0 12px 30px rgba(0,0,0,0.10)",
      },

      transitionDuration: {
        400: "400ms",
      },

    },
  },

  plugins: [],
}