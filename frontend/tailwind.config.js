/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cmds: {
          navy: '#016098',
          blue: '#024a8d',
          turquoise: '#39BABD',
          pink: '#EB567F',
          light: '#e0f2fe',
          bg: '#f4f7f6',
        },
      },
    },
  },
  plugins: [],
};
