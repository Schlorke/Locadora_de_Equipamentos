// Estrutura do CSS global do app (styles/): entrada enxuta, camadas (nada depois dos utilitários, como na produção em
// Tailwind 3, onde as classes venciam as regras de elemento) e o que não volta a existir. O limite de linhas e a
// camada overrides são do lint de CSS (tools/stylelint-css-structure.mjs).
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const stylesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'styles'
)
/** Sem comentários; strings ficam intactas (um glob como '**\/*.test.*' tem "/*" e não abre comentário). */
const strip = (css: string) =>
  css.replace(
    /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\/\*[\s\S]*?\*\//g,
    (match, text: string | undefined) => text ?? ''
  )
const files = (readdirSync(stylesDir, { recursive: true }) as string[])
  .map((file) => file.split(path.sep).join('/'))
  .filter((file) => file.endsWith('.css'))
  .sort()
const raw = (file: string) => readFileSync(path.join(stylesDir, file), 'utf8')
const read = (file: string) => strip(raw(file))

/** Nomes dos blocos `@layer x { … }` do arquivo. */
const layerBlocks = (css: string) =>
  [...css.matchAll(/@layer\s+([\w.-]+)\s*\{/g)].map((m) => m[1]!)

describe('CSS global do app', () => {
  it('tem os arquivos de uma responsabilidade cada, com terceiros em vendor/', () => {
    expect(files).toEqual([
      'animations.web.css',
      'base.web.css',
      'components.web.css',
      'forms.web.css',
      'globals.web.css',
      'layout.web.css',
      'outline.web.css',
      'scrollbars.web.css',
      'utilities.web.css',
      'vendor/base-ui.web.css',
      'vendor/day-picker-states.web.css',
      'vendor/day-picker.web.css',
      'vendor/recharts.web.css',
    ])
  })

  it('declara as camadas theme, base, components e utilities, nessa ordem, sem nenhuma depois dos utilitários', () => {
    const statements = [
      ...read('globals.web.css').matchAll(/@layer\s+([\w.,\s-]+);/g),
    ].map((m) => m[1]!.split(',').map((name) => name.trim()))
    expect(statements).toEqual([['theme', 'base', 'components', 'utilities']])
  })

  it('a entrada só tem ordem das camadas, imports, @config, a ponte @theme e @source, em até 60 linhas', () => {
    const entry = raw('globals.web.css')
    expect(entry.split('\n').length).toBeLessThanOrEqual(60)
    // Fora do bloco @theme, o nível de cima só tem at-rules de uma linha.
    const outside = read('globals.web.css').replace(
      /@theme\s+inline\s*\{[^}]*\}/,
      ''
    )
    const statements = outside
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const statement of statements)
      expect(statement, statement).toMatch(/^@(layer|import|config|source)\s/)
    expect(outside).not.toMatch(/[{}]/)
    // Os tokens vêm do design-tokens: nenhuma variável de tema declarada no app.
    for (const file of files)
      expect(read(file), file).not.toMatch(/(^|\n)\s*(:root|\.dark)\s*\{/)
  })

  it('a entrada importa os tokens do design-tokens e todos os arquivos de estilo', () => {
    const globals = read('globals.web.css')
    for (const tokens of ['theme.css', 'tokens.css'])
      expect(globals).toContain(
        `@import '@gb-locacoes/design-tokens/${tokens}';`
      )
    // As variáveis com nome de hash (legacy.css) viraram tokens nomeados do tokens.css: o arquivo não existe mais.
    expect(globals).not.toMatch(/legacy\.css/)
    for (const file of files.filter((f) => f !== 'globals.web.css'))
      expect(globals, file).toContain(`@import './${file}';`)
  })

  it('o Tailwind usa fontes explícitas sem testes nem fixtures e o config JS não fornece content', () => {
    const globals = read('globals.web.css')
    expect(globals).toContain("@source not '../../../../../**/*.test.*';")
    expect(globals).toContain("@source not '../../../../../**/*.spec.*';")
    expect(globals).toContain(
      "@source not '../../../../../**/__fixtures__/**';"
    )
    // Após F, só o CSS fornece fontes; o config JS não pode voltar a fornecer globs da raiz.
    expect(globals).toContain("@import 'tailwindcss' source(none);")
    expect(globals).toContain("@source '../../../../ui/src';")
    expect(globals).toContain("@source '../../';")
    expect(globals).toContain("@source '../../../../../apps/clients/web/src';")
    const configFile = path.resolve(
      stylesDir,
      '..',
      '..',
      '..',
      '..',
      '..',
      'tailwind.config.cjs'
    )
    expect(globals).toContain("@config '../../../../../tailwind.config.cjs';")
    const config = createRequire(import.meta.url)(configFile) as {
      content: string[]
    }
    expect(config.content).toEqual([])
  })

  it('cada arquivo abre com um cabeçalho de 1 a 3 linhas', () => {
    for (const file of files) {
      const header = /^\/\*([\s\S]*?)\*\//.exec(raw(file))
      expect(header, file).not.toBeNull()
      expect(header![0].split('\n').length, file).toBeLessThanOrEqual(3)
    }
  })

  it('não usa mais a camada overrides nem sub-camadas depois dos utilitários', () => {
    for (const file of files) {
      expect(read(file), file).not.toMatch(/overrides/)
      for (const name of layerBlocks(read(file)))
        expect(['base', 'components'], `${file}: @layer ${name}`).toContain(
          name
        )
    }
  })

  it('cor de borda padrão, títulos, parágrafos, textos pequenos e seções na base; barra de rolagem padrão em components', () => {
    /** Declarações da regra `selector { … }` dentro do bloco `@layer <camada> { … }` do arquivo. */
    const rule = (file: string, layer: string, selector: string) => {
      const block =
        new RegExp(String.raw`@layer ${layer}\s*\{([\s\S]*)\}\s*$`).exec(
          read(file)
        )?.[1] ?? ''
      const found = new RegExp(
        String.raw`(^|[{};])\s*` +
          selector.replace('*', String.raw`\*`) +
          String.raw`\s*\{([^{}]*)\}`
      ).exec(block)
      return found?.[2]?.replace(/\s+/g, ' ').trim()
    }
    expect(rule('base.web.css', 'base', '*')).toBe(
      'border-color: hsl(var(--border));'
    )
    expect(rule('base.web.css', 'base', 'h1')).toBe(
      'font-size: var(--font-size-h1); line-height: var(--line-height-h1); font-family: var(--font-jost), sans-serif; font-weight: 700; letter-spacing: var(--letter-spacing-display);'
    )
    expect(rule('base.web.css', 'base', 'h2')).toBe(
      'font-size: var(--font-size-h2); line-height: var(--line-height-h2); font-family: var(--font-jost), sans-serif; font-weight: 600; letter-spacing: var(--letter-spacing-display);'
    )
    expect(rule('base.web.css', 'base', 'h3')).toBe(
      'font-size: var(--font-size-h3); line-height: var(--line-height-h3); font-family: var(--font-jost), sans-serif; font-weight: 600;'
    )
    expect(rule('base.web.css', 'base', 'p')).toBe(
      'font-size: var(--font-size-paragraph); line-height: var(--line-height-paragraph);'
    )
    expect(rule('base.web.css', 'base', 'small')).toBe(
      'font-size: var(--font-size-small); line-height: var(--line-height-small);'
    )
    expect(rule('base.web.css', 'base', 'section')).toBe(
      'width: 100%; max-width: 100vw; overflow-x: hidden;'
    )
    // A barra padrão fica em components: o plugin tailwind-scrollbar zera scrollbar-* de `*` no fim da camada base.
    expect(rule('scrollbars.web.css', 'components', '*')).toBe(
      'scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) var(--scroll-track);'
    )
    // Nenhum outro arquivo repete essas regras de elemento (em outra camada, mudariam quem vence as classes).
    const elementRule =
      /(^|[{};,]\s*)(\*|h[1-3]|p|small|section|:where\((\*|h[1-3]|p|small|section)[^)]*\))\s*[{,]/g
    for (const file of files.filter((f) => f !== 'base.web.css')) {
      const hits = [...read(file).matchAll(elementRule)].map((m) => m[2])
      expect(hits, file).toEqual(file === 'scrollbars.web.css' ? ['*'] : [])
    }
  })

  it('sem exceções à cor de borda e à tipografia padrão: nenhum marcador data-own-border/data-own-type e revert-layer só no estilo do contorno', () => {
    for (const file of files)
      expect(read(file), file).not.toMatch(/data-own-(border|type)/)
    // O único revert-layer é o do contorno da produção (outline.web.css): outline-<n> só dá a largura e, sem utilitário
    // de estilo no elemento, o estilo é o das camadas de baixo e do navegador (o anel do foco por teclado).
    const reverts = files.flatMap((file) =>
      [...read(file).matchAll(/[^;{}]*revert-layer[^;{}]*/g)].map(
        (m) => `${file}: ${m[0].trim()}`
      )
    )
    expect(reverts).toEqual([
      'outline.web.css: outline-style: var(--tw-tw3-outline-style, revert-layer)',
    ])
    const packages = path.resolve(stylesDir, '..', '..', '..', '..')
    const sources = ['frontend/src', 'ui/src'].flatMap((dir) =>
      (readdirSync(path.join(packages, dir), { recursive: true }) as string[])
        .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\./.test(file))
        .map((file) => path.join(packages, dir, file))
    )
    expect(sources.length).toBeGreaterThan(100)
    for (const file of sources)
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /data-own-(border|type)/
      )
  })

  it('sem nome de hash, sem transition: all e sem cabeçalho que desliga lint', () => {
    for (const file of files) {
      const css = raw(file)
      expect(css, file).not.toMatch(/--legacy-/)
      expect(read(file), file).not.toMatch(
        /transition(-property)?\s*:\s*all\b|\btransition-all\b/
      )
      expect(css, file).not.toMatch(
        /stylelint-disable|eslint-disable|microsoft-edge-tools-disable/
      )
    }
  })

  it('a revelação por rolagem (slide-in-up) sobe 60px, como na produção (main, Tailwind 3)', () => {
    const keyframes =
      /@keyframes slide-in-up\s*\{\s*(?:from|0%)\s*\{([^}]*)\}\s*(?:to|100%)\s*\{([^}]*)\}/.exec(
        read('animations.web.css')
      )
    expect(keyframes, '@keyframes slide-in-up').not.toBeNull()
    const declarations = (block: string) => block.replace(/\s+/g, ' ').trim()
    expect(declarations(keyframes![1]!)).toBe(
      'opacity: 0; transform: translate3d(0, 60px, 0);'
    )
    expect(declarations(keyframes![2]!)).toBe(
      'opacity: 1; transform: translate3d(0, 0, 0);'
    )
  })

  it('os controles de formulário não têm mais estilo global', () => {
    for (const file of files) {
      const css = read(file)
      for (const pattern of [
        /\.header-action-button/,
        /\.filter-reset-button/,
        /\.admin-filter-element/,
        /\.input-description/,
        /button\[role=['"]checkbox['"]\]\s*[{:,[]/,
        /textarea\.flex/,
        /\[class\*=/,
        /(^|[^-])ring-width\s*:/,
      ])
        expect(css, `${file}: ${pattern}`).not.toMatch(pattern)
    }
  })
})
