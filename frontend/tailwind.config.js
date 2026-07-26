/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff', 100: '#d9e8ff', 200: '#bcd6ff', 300: '#8ebcff',
          400: '#5996ff', 500: '#3470f6', 600: '#2054eb', 700: '#1a42d8',
          800: '#1c38af', 900: '#1d3489',
        },
      },
    },
  },
  plugins: [],
}
