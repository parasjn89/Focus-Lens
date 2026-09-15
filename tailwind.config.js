/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#10232A',
          slate: '#3D4D55',
          gray: '#A79E9C',
          beige: '#D3C3B9',
          sand: '#B58863',
          black: '#161616',
          // keep some old brand shades for legacy dashboard compatibility
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        navy: {
          // updated base navy to match new palette for existing classes
          700: '#3D4D55',
          800: '#223842',
          900: '#10232A',
          950: '#0B181D',
        },
        slate: {
          850: '#151e2e',
          950: '#0b0f17',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'text-shimmer': 'textShimmer 3s ease-in-out infinite alternate',
      },
      keyframes: {
        textShimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        }
      }
    },
  },
  plugins: [],
}
