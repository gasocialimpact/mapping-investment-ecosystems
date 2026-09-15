import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Familjen Grotesk"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          indigo:    { DEFAULT: '#4750a2', light: '#929adf', soft: '#bdc7ec' },
          green:     { DEFAULT: '#279a49', light: '#66b445', soft: '#e0f1d9' },
          teal:      { DEFAULT: '#53c3c2', light: '#369b99', soft: '#d4f1f0' },
          orange:    { DEFAULT: '#f15921', soft: '#f8dcd3' },
          yellow:    { DEFAULT: '#f1d25b', light: '#f5de76', soft: '#fcf3cf' },
          gray:      { DEFAULT: '#939699', soft: '#eeeeee' },
          mint:      '#e9f8ea',
        },
      },
    },
  },
  plugins: [
    // `pdf:` applies while a single-page PDF export is in progress
    // (body.pdf-fixed). Responsive lg:/xl: classes are viewport media
    // queries, which don't match during print when the window or embed
    // iframe is narrow — pdf: variants force the wide layout regardless.
    plugin(({ addVariant }) => {
      addVariant('pdf', 'body.pdf-fixed &');
    }),
  ],
};
