// postcss.config.cjs
// Tailwind CSS v4: o plugin PostCSS mora em @tailwindcss/postcss.
// Prefixos de vendor passam a ser feitos pelo próprio Tailwind.
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
