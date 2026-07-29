import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  safelist: [{ pattern: /^bg-(stone|sky|emerald|violet|amber|lime|rose)-400$/ }],
  theme: { extend: {} },
  plugins: [],
};
export default config;
