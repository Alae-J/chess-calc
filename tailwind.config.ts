import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}', './src/dev/index.html'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-elevated': 'var(--surface-elevated)',
        border: 'var(--border)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        accent: 'var(--accent)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        overlay: 'var(--radius-overlay)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      keyframes: {
        'card-enter': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'focus-pulse': {
          '0%, 100%': { backgroundColor: 'var(--surface-elevated)' },
          '50%': { backgroundColor: 'var(--accent)' },
        },
      },
      animation: {
        'card-enter': 'card-enter 150ms ease-out',
        'focus-pulse': 'focus-pulse 120ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
