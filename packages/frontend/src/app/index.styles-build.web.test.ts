// A mesma entrada CSS compilada pelo Tailwind com duas bases de resolução: repositório e host web.
// Isto prova independência da base e preservação de tokens/semântica CSS; não executa o Next build legado.
// Valores canônicos em packages/design-tokens e referência Tailwind 3.4.17 da produção.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { primitives } from '@gb-locacoes/design-tokens'
import { beforeAll, describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..', '..', '..')
const entry = path.join(here, 'styles', 'globals.web.css')
const requireFromRoot = createRequire(path.join(repoRoot, 'package.json'))

interface Decl {
  prop: string
  value: string
  important: boolean
  parent?: { selector?: string; name?: string; params?: string }
}
interface Compiled {
  css: string
  decls: Decl[]
}

/** Tons da paleta (famílias × 50–950, black e white) como utilitários de fundo, para o tema emitir todas as cores. */
const paletteProbe = Object.keys(primitives.tailwind)
  .map((key) => `bg-${key.replace(/(\d+)$/, '-$1')}`)
  .join(' ')
/** Direções do degradê (bg-gradient-to-*) e o `to …` de cada uma. */
const GRADIENTS = {
  t: 'top',
  tr: 'top right',
  r: 'right',
  br: 'bottom right',
  b: 'bottom',
  bl: 'bottom left',
  l: 'left',
  tl: 'top left',
} as const
const gradientProbe = Object.keys(GRADIENTS)
  .map((d) => `bg-gradient-to-${d}`)
  .join(' ')
const probe = `\n@source inline("text-base text-small text-h1 text-h2 text-h3 ${gradientProbe} ${paletteProbe}");\n`

async function compile(base: string): Promise<Compiled> {
  const postcss = requireFromRoot('postcss')
  const tailwind = requireFromRoot('@tailwindcss/postcss')
  const result = await postcss([tailwind({ base, optimize: false })]).process(
    readFileSync(entry, 'utf8') + probe,
    { from: entry }
  )
  const decls: Decl[] = []
  result.root.walkDecls((decl: Decl) => {
    decls.push(decl)
  })
  return { css: result.css, decls }
}

/** Declarações da regra de seletor exato (fora de @media), na ordem do CSS. */
const ruleOf = (compiled: Compiled, selector: string) =>
  Object.fromEntries(
    compiled.decls
      .filter((d) => d.parent?.selector === selector)
      .map((d) => [d.prop, d.value])
  )
/** Valor de uma variável de tema (`--color-orange-600`) no CSS compilado. */
const themeVar = (compiled: Compiled, name: string) =>
  compiled.decls.find((d) => d.prop === name)?.value

let web: Compiled
let root: Compiled
beforeAll(async () => {
  ;[web, root] = await Promise.all([
    compile(path.join(repoRoot, 'apps', 'clients', 'web')),
    compile(repoRoot),
  ])
}, 300_000)

describe('fontes de classes do CSS global', () => {
  it('a mesma entrada CSS compila com base na raiz e no host web sem depender da pasta de trabalho', () => {
    // Sem source(none), o build da raiz lia a raiz inteira (docs/, tools/…) e gerava classes citadas em texto.
    expect(root.css.length).toBe(web.css.length)
    expect(root.css).toBe(web.css)
  })

  it('nenhuma regra com !important nos dois builds, além do [hidden] do preflight do próprio Tailwind', () => {
    for (const compiled of [web, root]) {
      const important = compiled.decls
        .filter((d) => d.important)
        .map((d) => `${d.parent?.selector} { ${d.prop} }`)
      expect(important).toEqual([
        '[hidden]:where(:not([hidden="until-found"])) { display }',
      ])
    }
  })

  it('a camada interna das abas conserva o z-index 10 pelo token canônico nos dois builds', () => {
    for (const compiled of [web, root]) {
      const layer = compiled.decls.filter(
        (decl) =>
          decl.parent?.selector?.replace(/\\/g, '') ===
          '.z-[var(--layer-inset)]'
      )
      expect(layer.map(({ prop, value }) => [prop, value])).toEqual([
        ['z-index', 'var(--layer-inset)'],
      ])
      expect(themeVar(compiled, '--layer-inset')).toBe('10')
      expect(ruleOf(compiled, '.z-10')).toEqual({ 'z-index': '10' })
    }
  })
})

describe('paleta e tipografia da produção (Tailwind 3.4.17)', () => {
  it('cada tom da paleta é o hex da produção, não o OKLCH do Tailwind 4 (orange-600 = #ea580c)', () => {
    expect(themeVar(web, '--color-orange-600')).toBe('#ea580c')
    for (const [key, hex] of Object.entries(primitives.tailwind)) {
      const name = `--color-${key.replace(/(\d+)$/, '-$1')}`
      expect(themeVar(web, name), name).toBe(hex)
    }
  })

  it('bg-orange-600 e text-orange-600 leem a cor do tema', () => {
    expect(ruleOf(web, '.bg-orange-600')).toEqual({
      'background-color': 'var(--color-orange-600)',
    })
    expect(ruleOf(web, '.text-orange-600')).toEqual({
      color: 'var(--color-orange-600)',
    })
  })

  it('text-base e text-small são tamanho de fonte fluido com altura de linha, como na produção, e nunca cor', () => {
    const { fluid } = primitives.typography
    for (const [cls, level] of [
      ['text-base', fluid.base],
      ['text-small', fluid.small],
      ['text-h1', fluid.h1],
      ['text-h2', fluid.h2],
      ['text-h3', fluid.h3],
    ] as const) {
      const name = cls.slice('text-'.length)
      // Os tamanhos do tailwind.config.cjs (tema de compatibilidade) entram como valor literal na regra. A altura de
      // linha é a da escala, como no Tailwind 3 (utilities.web.css): sem ler --tw-leading, um leading-* do elemento
      // não vence o text-* de uma variante responsiva (leading-tight md:text-3xl).
      expect(ruleOf(web, `.${cls}`), cls).toEqual({
        'font-size': level.css,
        'line-height': String(level.lineHeight),
      })
      expect(themeVar(web, `--color-${name}`), cls).toBeUndefined()
    }
  })

  it('bg-gradient-to-* interpola em sRGB como na produção, não `in oklab` (os tons do meio do degradê mudavam)', () => {
    for (const [dir, to] of Object.entries(GRADIENTS)) {
      const rule = ruleOf(web, `.bg-gradient-to-${dir}`)
      expect(rule['--tw-gradient-position'], dir).toBe(`to ${to}`)
      expect(rule['background-image'], dir).toBe(
        'linear-gradient(var(--tw-gradient-stops))'
      )
    }
  })
})

describe('estado de erro dos campos', () => {
  it('o estado de erro dos campos (aria-invalid) compila com a borda e o halo de erro dos tokens', () => {
    const rules = (prop: string, value: string) =>
      web.decls
        .filter(
          (d) =>
            d.prop === prop &&
            d.value === value &&
            /\[aria-invalid="true"\]/.test(d.parent?.selector ?? '')
        )
        .map((d) => d.parent?.selector)
    // A ponte `@theme inline` (--color-field-invalid) grava a variável do token direto na regra.
    expect(rules('border-color', 'var(--field-invalid)')).toEqual([
      '.aria-invalid\\:border-field-invalid[aria-invalid="true"]',
      '.aria-invalid\\:focus\\:border-field-invalid[aria-invalid="true"]:focus',
    ])
    expect(rules('box-shadow', 'var(--shadow-control-invalid-focus)')).toEqual([
      '.aria-invalid\\:focus\\:shadow-control-invalid-focus[aria-invalid="true"]:focus',
    ])
    expect(themeVar(web, '--field-invalid')).toBe('#ef4444')
    expect(themeVar(web, '--shadow-control-invalid-focus')).toMatch(
      /, 0 0 0 3px var\(--field-invalid-halo\)$/
    )
  })
})
