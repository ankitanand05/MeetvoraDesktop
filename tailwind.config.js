/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'sound-bar-1': 'soundBar1 0.6s ease-in-out infinite',
        'sound-bar-2': 'soundBar2 0.6s ease-in-out 0.15s infinite',
        'sound-bar-3': 'soundBar3 0.6s ease-in-out 0.3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        soundBar1: {
          '0%, 100%': { height: '4px' },
          '50%': { height: '16px' },
        },
        soundBar2: {
          '0%, 100%': { height: '8px' },
          '50%': { height: '20px' },
        },
        soundBar3: {
          '0%, 100%': { height: '4px' },
          '50%': { height: '12px' },
        },
      },
    },
  },
  plugins: [],
};
