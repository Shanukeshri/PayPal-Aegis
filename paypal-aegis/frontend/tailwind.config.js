/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        paypal: {
          blue: '#0070BA',
          darkBlue: '#003087',
          tint: '#EFF6FF',
        },
        aegis: {
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          subtle: '#F1F5F9',
          border: '#E2E8F0',
          ink: '#0F172A',
          muted: '#6B7280',
          accent: '#0070BA',
          danger: '#DC2626',
          warning: '#D97706',
          success: '#059669',
        },
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
        modal: '0 16px 32px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};
