import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
it('condição native monta modelos comuns e conserva entrada web', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
  )
  expect(pkg.exports['./pages/orcamentos-admin']).toEqual({
    'react-native': './src/pages/orcamentos-admin/index.native.ts',
    default: './src/pages/orcamentos-admin/index.ts',
  })
  for (const f of ['index.ts', 'index.native.ts']) {
    const code = readFileSync(new URL('./' + f, import.meta.url), 'utf8')
    expect(code).toContain('AdminQuotesPageWrapper')
    expect(code).toContain('QuoteDetailPage')
    expect(code).not.toContain('export *')
  }
  for (const f of [
    'dados.ts',
    'detalhe.ts',
    'editors.ts',
    'documents.ts',
    'calendar.ts',
  ]) {
    const code = readFileSync(new URL('./model/' + f, import.meta.url), 'utf8')
    for (const forbidden of [
      'next/',
      'sonner',
      'react-native',
      'window.',
      'document.',
      'requestAnimationFrame',
    ])
      expect(code).not.toContain(forbidden)
  }
})
