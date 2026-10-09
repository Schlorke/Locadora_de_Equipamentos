// Seletores da revelação por rolagem: toda classe que o ScrollRevealInit procura tem um elemento no JSX do produto.
// Classe sem elemento é código morto (como .animate-on-scroll, .animate-on-scroll-delayed, .category-card-animate e
// .hero-badge-bottom, retiradas).
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(here, '..', '..')
const source = readFileSync(path.join(here, 'ScrollRevealInit.web.tsx'), 'utf8')

/** Classes do seletor `selectors` do ScrollRevealInit (os atributos [data-*] ficam de fora). */
function revealClasses(): string[] {
  const literal =
    /const selectors =\s*((?:'[^']*'\s*\+?\s*)+)/.exec(source)?.[1] ?? ''
  const joined = [...literal.matchAll(/'([^']*)'/g)].map((m) => m[1]).join('')
  return joined
    .split(',')
    .map((selector) => selector.trim())
    .filter((selector) => selector.startsWith('.'))
    .map((selector) => selector.slice(1))
}

const jsx = (readdirSync(src, { recursive: true }) as string[])
  .map((file) => file.split(path.sep).join('/'))
  .filter(
    (file) =>
      file.endsWith('.tsx') &&
      !/\.test\./.test(file) &&
      !file.endsWith('ScrollRevealInit.web.tsx')
  )
  .map((file) => readFileSync(path.join(src, file), 'utf8'))

describe('ScrollRevealInit: seletores da revelação', () => {
  it('toda classe procurada tem um elemento no JSX (sem classe morta)', () => {
    const classes = revealClasses()
    expect(classes.length).toBeGreaterThan(15)
    const unused = classes.filter(
      (name) =>
        !jsx.some((code) =>
          new RegExp(
            String.raw`className=[{"'\x60][^>]*?(?<![\w-])${name}(?![\w-])`
          ).test(code)
        )
    )
    expect(unused).toEqual([])
    // Onda 134: os selos do hero e da Sobre voltaram (só com o conteúdo da própria locadora) e participam da revelação.
    for (const selo of [
      'hero-badge-left',
      'hero-badge-right',
      'hero-badge-top-left',
    ])
      expect(classes).toContain(selo)
    for (const dead of [
      'animate-on-scroll',
      'animate-on-scroll-delayed',
      'category-card-animate',
      'category-card',
      'hero-badge-bottom',
    ])
      expect(source).not.toContain(dead)
  })
})
