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
        }
      }
    },
  },
  plugins: [],
}
