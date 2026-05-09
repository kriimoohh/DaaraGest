import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['attribute', 'data-theme'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper:   'var(--paper)',
        paper2:  'var(--paper-2)',
        paper3:  'var(--paper-3)',
        card:    'var(--card)',
        rule:    'var(--rule)',
        rule2:   'var(--rule-2)',
        ink:     'var(--ink)',
        ink2:    'var(--ink-2)',
        ink3:    'var(--ink-3)',
        ink4:    'var(--ink-4)',
        terra:   'var(--terra)',
        'terra-deep': 'var(--terra-deep)',
        'terra-soft': 'var(--terra-soft)',
        'terra-ink':  'var(--terra-ink)',
        sahel:   'var(--sahel)',
        'sahel-soft': 'var(--sahel-soft)',
        'sahel-ink':  'var(--sahel-ink)',
        indigo:  'var(--indigo)',
        'indigo-soft': 'var(--indigo-soft)',
        'indigo-ink':  'var(--indigo-ink)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans:    ['"Instrument Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        arabic:  ['"Noto Naskh Arabic"', 'serif'],
      },
      boxShadow: {
        sm:  '0 1px 2px rgba(27,24,18,0.04)',
        md:  '0 4px 16px rgba(27,24,18,0.08)',
        lg:  '0 12px 40px rgba(27,24,18,0.16)',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '18px',
      },
    },
  },
  plugins: [],
};

export default config;
