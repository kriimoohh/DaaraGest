import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary:   '#10B981',
          secondary: '#14B8A6',
          accent:    '#F59E0B',
          night:     '#0F172A',
          surface:   '#1E293B',
          light:     '#F1F5F9',
        },
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', 'system-ui', 'sans-serif'],
        body:    ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        arabic:  ['"Noto Naskh Arabic"', 'serif'],
      },
      boxShadow: {
        'brand-sm': '0 1px 3px 0 rgba(16,185,129,0.15)',
        'brand':    '0 4px 12px 0 rgba(16,185,129,0.25)',
        'accent-sm':'0 1px 3px 0 rgba(245,158,11,0.20)',
      },
    },
  },
  plugins: [],
};

export default config;
