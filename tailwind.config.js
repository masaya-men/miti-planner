/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--color-bg-primary)',
          surface: 'var(--color-bg-secondary)',
          surface2: 'var(--color-bg-tertiary)',
          accent: 'var(--color-accent-primary)',
          'accent-bold': 'var(--color-accent-secondary)',
          'accent-dim': 'var(--color-accent-dim)',
          text: 'var(--color-text-primary)',
          'text-sec': 'var(--color-text-secondary)',
          'text-muted': 'var(--color-text-muted)',
          border: 'var(--color-border)',
          'border-accent': 'var(--color-border-accent)',
        },
        glass: {
          header: 'var(--glass-bg-header)',
          panel: 'var(--glass-bg-panel)',
          card: 'var(--glass-bg-card)',
          border: 'var(--glass-border)',
          hover: 'var(--glass-hover)',
          active: 'var(--glass-active)',
        }
      },
      boxShadow: {
        'glass': 'var(--glass-shadow)',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(15vw, -15vh) scale(1.3)' }, // 画面の15%分大きく移動！
          '66%': { transform: 'translate(-20vw, 10vh) scale(0.8)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        // ...rippleは使わないのでそのまま放置か削除でOKです
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '0.4' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        }
      },
      animation: {
        blob: 'blob 10s infinite alternate',
        ripple: 'ripple 0.6s linear',
      }
    },
  },
  plugins: [],
}
