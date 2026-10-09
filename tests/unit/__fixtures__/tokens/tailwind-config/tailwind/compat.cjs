// Fixture: plugin local carregado pelo config com require.
module.exports = function compat({ addUtilities }) {
  addUtilities({ '.compat-hidden': { display: 'none !important' } })
}
