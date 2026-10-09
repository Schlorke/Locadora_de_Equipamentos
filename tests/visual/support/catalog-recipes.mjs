import assert from 'node:assert/strict'

/** @param {string | undefined} value */
export function parseCatalogRecipeFilter(value) {
  const names = value
    ?.split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  return names?.length ? names : undefined
}

/**
 * The canonical recipe/state declarations are the independent inventory oracle.
 * Count and exact keys must agree before an unfiltered capture can be written.
 * @param {Record<string, unknown>} captures
 * @param {Record<string, { states: ReadonlyArray<string> }>} recipes
 */
export function assertFullCatalogCaptures(captures, recipes) {
  const expected = [
    'base',
    ...Object.entries(recipes).flatMap(([recipe, entry]) =>
      entry.states.map((state) => `receita:${recipe}/${state}`)
    ),
  ]
  const actual = Object.keys(captures)
  assert.equal(
    actual.length,
    expected.length,
    `Full catalog capture incomplete: expected ${expected.length} base/recipe states, got ${actual.length}`
  )
  assert.deepEqual(
    actual.sort(),
    expected.sort(),
    'Full catalog capture keys differ from canonical recipe/state declarations'
  )
}
