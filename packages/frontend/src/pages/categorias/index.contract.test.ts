import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('contrato categorias', () => {
  it('exporta AdminCategoriesPage pelo index público do slice', () => {
    const index = readFileSync(
      new URL('./index.ts', import.meta.url),
      'utf8'
    ).replaceAll("'", '"')
    expect(index).toContain(
      'export { AdminCategoriesPage } from "./ui/CategoriasPage.web"'
    )
  })
})

it('default conserva a API web e react-native seleciona as apresentações nativas implementadas', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
  )
  expect(pkg.exports['./pages/categorias']).toEqual({
    'react-native': './src/pages/categorias/index.native.ts',
    default: './src/pages/categorias/index.ts',
  })
  const native = readFileSync(
    new URL('./index.native.ts', import.meta.url),
    'utf8'
  )
  for (const name of [
    'CategoriasPage.native',
    'CategoriaDialog.native',
    'VerCategoria.native',
  ])
    expect(native).toContain(name)
  expect(native).not.toContain('.web')
  expect(native).not.toContain('export *')
})
