import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        'primary-light': '#EFF6FF',
        surface: '#FFFFFF',
        background: '#F4F6F9',
        border: '#E5E7EB',
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        // kept for backwards compat with existing pages
        dark: '#0D1B35',
        navy: '#1A2D5A',
        teal: '#0D7A6B',
        gold: '#D4A017',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
