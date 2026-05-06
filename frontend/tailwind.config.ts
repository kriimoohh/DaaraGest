import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Noto Naskh Arabic', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
