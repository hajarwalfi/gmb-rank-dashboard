/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        serif: ['"DM Serif Display"', 'serif'],
      },
      colors: {
        brand: {
          white: '#ffffff',
          frost: '#f5faf5',
          mint: '#d4edd4',
          sage: '#5db87a',
          forest: '#2e8b57',
          pine: '#1a5c38',
          midnight: '#0f2e1b',
          seafoam: '#a8d5b5',
          lime: '#c8f0b8',
          muted: '#6b7c70',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #2e8b57 0%, #1a5c38 100%)',
      },
      screens: {
        xs: '480px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        xxl: '1500px',
        xxxl: '1920px',
      },
    },
  },
  plugins: [],
};
