import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
it('entrada seleciona nativo e conserva o contrato web sem export global', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
  )
  expect(pkg.exports['./pages/locacoes']).toEqual({
    'react-native': './src/pages/locacoes/index.native.ts',
    default: './src/pages/locacoes/index.ts',
  })
  for (const name of ['index.ts', 'index.native.ts']) {
    const code = readFileSync(new URL('./' + name, import.meta.url), 'utf8')
    expect(code).toContain('AdminRentalsPage')
    expect(code).not.toContain('export *')
  }
})
