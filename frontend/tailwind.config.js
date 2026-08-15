/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  theme: {
    extend: {

      fontFamily: {
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans:  ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono:  ["'JetBrains Mono'", "monospace"],
      },

      colors: {
        // Clinical Light palette -- named, deliberate, not a generic default.
        paper:   "#FAFBFA",   // page background -- soft paper, not stark white
        ink:     "#1C2321",   // primary text -- deep slate, not pure black
        muted:   "#5B6764",   // secondary text
        line:    "#E4E7E4",   // hairline borders

        teal: {
          50:  "#EEF4F3",
          100: "#DCE9E7",
          400: "#5C938B",
          500: "#3D7068",   // primary accent
          600: "#2F5852",
          700: "#254742",
        },

        clinical: {
          red:      "#B4413A",
          "red-bg": "#FBEAE8",
          green:      "#4F7A52",
          "green-bg": "#EDF3ED",
          amber:      "#B08135",
          "amber-bg": "#FBF3E4",
        },
      },

      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },

      boxShadow: {
        card: "0 1px 2px rgba(28,35,33,0.04), 0 1px 12px rgba(28,35,33,0.03)",
        raised: "0 4px 16px rgba(28,35,33,0.06)",
      },

      transitionDuration: {
        400: "400ms",
      },

    },
  },
  plugins: [],
}
