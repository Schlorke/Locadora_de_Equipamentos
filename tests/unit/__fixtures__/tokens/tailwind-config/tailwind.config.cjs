// Fixture de tools/token-check.mjs: a opção important ligada deixa todo utilitário !important sem !important escrito.
module.exports = {
  important: true,
  theme: { extend: { colors: { important: '#ea580c' } } },
  plugins: [require('./tailwind/compat.cjs'), require('tailwind-scrollbar')],
}
