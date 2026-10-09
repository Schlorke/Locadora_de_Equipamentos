import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('mantém exports web e seleciona apresentação native sobre modelo sem DOM/Next/Sonner', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
  )
  expect(pkg.exports['./pages/configuracoes']).toEqual({
    'react-native': './src/pages/configuracoes/index.native.ts',
    default: './src/pages/configuracoes/index.ts',
  })
  const model = readFileSync(
    new URL('./model/use-settings-data.tsx', import.meta.url),
    'utf8'
  )
  expect(model).not.toMatch(
    /document\.|HTMLInputElement|<strong|from ['"](?:next|sonner)/
  )
  const web = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
  expect(web).toContain('AdminConfiguracoesPage')
  expect(web).toContain('HeroCarouselManager')
  expect(web).toContain('SettingsProvider')
})
