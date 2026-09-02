import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface-1)',
        page: 'var(--page)',
        ink: 'var(--text-primary)',
        muted: 'var(--text-muted)',
      },
    },
  },
  plugins: [],
};
export default config;
