export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1A6BFF',
          light: '#4D8EFF',
          dark: '#0047CC',
          50:  '#EEF4FF',
          100: '#D6E6FF',
        },
        surface: '#F4F6FF',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      boxShadow: {
        card:      '0 2px 16px 0 rgba(26,107,255,0.08)',
        'card-lg': '0 8px 32px 0 rgba(26,107,255,0.14)',
      },
    }
  },
  plugins: [],
};