import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('entrada mantém default web e seleciona a variante nativa com modelos universais', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
  )
  expect(manifest.exports['./pages/manutencao']).toEqual({
    'react-native': './src/pages/manutencao/index.native.ts',
    default: './src/pages/manutencao/index.ts',
  })
  for (const file of [
    'carga.ts',
    'contracts.ts',
    'calendar.ts',
    'display.ts',
  ]) {
    const source = readFileSync(
      new URL('./model/' + file, import.meta.url),
      'utf8'
    )
    expect(source).not.toMatch(
      /from ['"](?:next\/|sonner|lucide-react|react-native)/
    )
    expect(source).not.toMatch(/\b(?:window|document)\./)
  }
})
