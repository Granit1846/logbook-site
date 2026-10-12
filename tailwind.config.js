/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#5B7C99',
          50: '#f0f4f8',
          100: '#dce5ee',
          200: '#b9c9da',
          300: '#96adcc',
          400: '#7392bd',
          500: '#5B7C99',
          600: '#48657f',
          700: '#3a5066',
          800: '#2c3c4d',
          900: '#1e2833',
        },
        warm: {
          DEFAULT: '#F4A460',
          50: '#fdf6ee',
          100: '#fae8d4',
          200: '#f4d0a8',
          300: '#eeb87d',
          400: '#e9a363',
          500: '#F4A460',
          600: '#d68a4a',
          700: '#a86c3a',
          800: '#7a4e2a',
          900: '#4c311a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.5' }],
        lg: ['1.25rem', { lineHeight: '1.4' }],
        xl: ['1.25rem', { lineHeight: '1.3' }],
        '2xl': ['2rem', { lineHeight: '1.2' }],
        '3xl': ['3rem', { lineHeight: '1.1' }],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
      spacing: {
        '18': '4.5rem',
      },
      transitionDuration: {
        DEFAULT: '250ms',
      },
    },
  },
  plugins: [],
};
