import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import config from '../../.storybook/main'
import { createNextConfig } from '../../apps/clients/web/next.config.mjs'

/**
 * Storybook sem a raiz legada (onda 135, A2; E10 do plano de aposentadoria da raiz). O preview importava o CSS por
 * antiga `../app/globals.css`, retirada em F (reimportava o CSS do frontend), e o framework, sem `nextConfigPath`,
 * carregava o antigo `next.config.mjs` da raiz, retirado em F, pelo diretório de trabalho (`vite-plugin-storybook-nextjs`: `dir =
 * process.cwd()`). Com a raiz apagada, o build quebraria nos dois pontos. Agora o CSS vem da entrada pública do
 * frontend e a configuração do Next é a do host web.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

/** Especificadores de todo `import` (com ou sem `from`) do arquivo. */
const importsOf = (source: string) =>
  [
    ...source.matchAll(/^\s*import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm),
  ].map((match) => match[1])

describe('Storybook sem a raiz legada', () => {
  // A antiga app/ da raiz foi retirada em F; este oracle recusa que o preview volte a importar seu CSS/fachada.
  it('o preview carrega o CSS pela entrada pública do frontend e nada da raiz app/', () => {
    const specifiers = importsOf(read('.storybook/preview.tsx'))
    expect(specifiers).toContain('@gb-locacoes/frontend/app/styles.css')
    for (const specifier of specifiers)
      expect(specifier).not.toMatch(
        /(?:^|\/)app\/globals\.css$|^(?:\.\.\/)+app\//
      )
  })

  it('a entrada pública do CSS existe e é o globals do frontend', () => {
    const manifest = JSON.parse(read('packages/frontend/package.json')) as {
      exports: Record<string, unknown>
    }
    const target = manifest.exports['./app/styles.css']
    expect(target).toBe('./src/app/styles/globals.web.css')
    expect(
      fs.existsSync(path.join(ROOT, 'packages/frontend', String(target)))
    ).toBe(true)
  })

  it('o framework lê o next.config.mjs do host web, não o da raiz pelo diretório de trabalho', () => {
    const framework = config.framework as {
      name: string
      options?: { nextConfigPath?: string }
    }
    expect(framework.name).toBe('@storybook/nextjs-vite')
    const nextConfigPath = framework.options?.nextConfigPath
    expect(nextConfigPath).toBeDefined()
    expect(path.resolve(nextConfigPath!)).toBe(
      path.join(ROOT, 'apps', 'clients', 'web', 'next.config.mjs')
    )
    expect(fs.existsSync(nextConfigPath!)).toBe(true)
  })

  it('a configuração do host web monta sem variável de build (o Storybook não define nenhuma)', () => {
    const next = createNextConfig({})
    expect(next.images).toEqual({
      unoptimized: true,
      remotePatterns: expect.any(Array),
    })
    expect(next.transpilePackages).toContain('@gb-locacoes/frontend')
  })
})
