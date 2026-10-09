import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
it('seleciona UI nativa real e preserva entrada web sem dependência DOM nos modelos', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
  )
  expect(pkg.exports['./pages/financeiro']).toEqual({
    'react-native': './src/pages/financeiro/index.native.ts',
    default: './src/pages/financeiro/index.ts',
  })
  for (const path of ['index.ts', 'index.native.ts'])
    expect(
      readFileSync(new URL('./' + path, import.meta.url), 'utf8')
    ).toContain('AdminFinanceiroPageWrapper')
  for (const path of [
    'carga.ts',
    'detalhe.ts',
    'export.ts',
    'document.ts',
    'period.ts',
    'calendar.ts',
  ]) {
    const source = readFileSync(
      new URL('./model/' + path, import.meta.url),
      'utf8'
    )
    for (const forbidden of [
      'next/',
      'sonner',
      'react-native',
      'window.',
      'document.',
      'requestAnimationFrame',
    ])
      expect(source).not.toContain(forbidden)
  }
})
