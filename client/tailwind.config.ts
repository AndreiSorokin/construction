import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: 'class',
  safelist: [{ pattern: /^bg-(stone|sky|emerald|violet|amber|lime|rose)-400$/ }],
  theme: {
    extend: {
      // Нейтральная шкала переведена на CSS-переменные (см. globals.css) — значения
      // переключаются вместе с html.dark, поэтому bg-stone-*/text-stone-*/border-stone-*
      // по всему приложению становятся тёмной темой без правки каждого компонента.
      colors: {
        stone: {
          50: 'rgb(var(--stone-50) / <alpha-value>)',
          100: 'rgb(var(--stone-100) / <alpha-value>)',
          200: 'rgb(var(--stone-200) / <alpha-value>)',
          300: 'rgb(var(--stone-300) / <alpha-value>)',
          400: 'rgb(var(--stone-400) / <alpha-value>)',
          500: 'rgb(var(--stone-500) / <alpha-value>)',
          600: 'rgb(var(--stone-600) / <alpha-value>)',
          700: 'rgb(var(--stone-700) / <alpha-value>)',
          800: 'rgb(var(--stone-800) / <alpha-value>)',
          900: 'rgb(var(--stone-900) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
export default config;
