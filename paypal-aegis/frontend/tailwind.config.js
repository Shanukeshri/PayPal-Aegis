/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 3-Color Strict Palette:
        // 1. Primary: Very light colour near white, slight beige-like
        primary: {
          DEFAULT: '#F9F8F5',
          light: '#FDFCFB',
          dark: '#F2EFE9',
        },
        // 2. Secondary: Structural color (cards, borders, text)
        secondary: {
          DEFAULT: '#1C1917',
          card: '#FFFFFF',
          surface: '#F4F1EA',
          border: '#E5E0D8',
          muted: '#57534E',
          subtle: '#78716C',
        },
        // 3. Accent: Intentional PayPal brand blue for action items
        accent: {
          DEFAULT: '#0070BA',
          hover: '#005EA6',
          light: '#E6F2FA',
        },
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(28, 25, 23, 0.04), 0 1px 2px -1px rgba(28, 25, 23, 0.03)',
        card: '0 4px 6px -1px rgba(28, 25, 23, 0.04), 0 2px 4px -2px rgba(28, 25, 23, 0.03)',
      },
    },
  },
  plugins: [],
};
