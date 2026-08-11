/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        saffron: '#FF9933',
        indiagreen: '#138808',
        navy: '#0B1F3A',
      },
    },
  },
  plugins: [],
};
