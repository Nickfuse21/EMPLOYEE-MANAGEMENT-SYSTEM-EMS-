/** @type {import('tailwindcss').Config} */
export default {
  // Scan these files for class names to include in the final CSS.
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Dark mode is toggled by adding/removing the "dark" class on <html>
  // (see ThemeContext) — this satisfies the Dark Mode bonus feature.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Inter is loaded in index.html; fall back to the system stack.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // A full indigo→violet brand ramp so gradients and states feel cohesive.
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      boxShadow: {
        // Soft, layered shadows for a sense of depth.
        soft: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.12)',
        card: '0 1px 3px rgba(15,23,42,0.06), 0 12px 32px -16px rgba(15,23,42,0.18)',
        glow: '0 8px 30px -8px rgba(79,70,229,0.45)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        'brand-radial': 'radial-gradient(1200px circle at 0% 0%, rgba(99,102,241,0.15), transparent 40%), radial-gradient(1000px circle at 100% 0%, rgba(168,85,247,0.12), transparent 40%)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-18px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        // Large, slow drifting movement for aurora/mesh background blobs.
        blob: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -40px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.95)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease forwards',
        'fade-up': 'fade-up 0.5s ease forwards',
        float: 'float 7s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        'gradient-pan': 'gradient-pan 8s ease infinite',
        blob: 'blob 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
