import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('contrato migracao equipamentos-admin', () => {
  it('exporta AdminEquipmentsPage pelo index publico do slice', () => {
    const index = readFileSync(
      new URL('./index.ts', import.meta.url),
      'utf8'
    ).replaceAll("'", '"')
    expect(index).toContain('export { AdminEquipmentsPage }')
    expect(index).toContain('from "./ui/Lista"')
  })
})

it('entrada explícita conserva o web e resolve as duas telas efetivas no nativo', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
  )
  expect(manifest.exports['./pages/equipamentos-admin']).toEqual({
    'react-native': './src/pages/equipamentos-admin/index.native.ts',
    default: './src/pages/equipamentos-admin/index.ts',
  })
  const native = readFileSync(
    new URL('./index.native.ts', import.meta.url),
    'utf8'
  )
  expect(native).toContain('./ui/Lista.native')
  expect(native).toContain('./ui/Detalhe.native')
  expect(native).not.toContain('.web')
})
