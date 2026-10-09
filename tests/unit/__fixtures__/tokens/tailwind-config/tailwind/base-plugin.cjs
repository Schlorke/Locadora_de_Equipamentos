// Fixture: plugin local carregado pela folha de estilo com @plugin.
module.exports = function basePlugin({ addBase }) {
  addBase({ body: { margin: '0 !important' } })
}
