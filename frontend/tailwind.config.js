/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // `serif` is kept as an alias so existing heading classes resolve to the same family.
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: '#F7F9F9',
        ink: '#0F1B1A',
        muted: '#5A6968',
        line: '#E2E8E7',
        teal: {
          50: '#F0F7F6',
          100: '#D5E8E5',
          400: '#3E9A92',
          500: '#0F766E',
          600: '#0D645D',
          700: '#0B524D',
        },
        clinical: {
          red: '#B4413A',
          'red-bg': '#FBEAE8',
          green: '#4F7A52',
          'green-bg': '#EDF3ED',
          amber: '#B08135',
          'amber-bg': '#FBF3E4',
        },
      },
      borderRadius: { xl: '0.625rem', '2xl': '0.75rem' },
      boxShadow: {
        card: '0 1px 2px rgba(15,27,26,0.05)',
        raised: '0 4px 12px rgba(15,27,26,0.07)',
        soft: '0 1px 2px rgba(15,27,26,0.05)',
      },
    },
  },
  plugins: [],
}
