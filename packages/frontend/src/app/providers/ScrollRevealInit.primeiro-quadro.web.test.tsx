// Primeiro quadro da revelação por rolagem com movimento reduzido: os elementos que o ScrollRevealInit deixa parados
// (STILL_WHEN_REDUCED_MOTION) nascem visíveis sem depender do JS. No JSX eles só ficam escondidos na variante
// motion-safe (classe motion-safe:opacity-0); nunca com opacity-0 puro nem com opacity/transform no estilo inline.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { STILL_WHEN_REDUCED_MOTION } from './ScrollRevealInit.web'

const src = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const STILL_CLASSES = STILL_WHEN_REDUCED_MOTION.split(',').map((selector) =>
  selector.trim().replace(/^\./, '')
)

/** Seções da revelação e quantos elementos parados cada uma esconde no primeiro quadro (sem movimento reduzido). */
const SECTIONS: Record<string, number> = {
  'widgets/hero/ui/Hero.web.tsx': 5,
  'widgets/home-cliente/ui/Destaques.web.tsx': 3,
  'widgets/contato-home/ui/ContatoHome.web.tsx': 4,
  // 5: números, linha do tempo, valores, selo do Google e CTA (os de 55763c1e). Na onda 132 os números e a linha do
  // tempo da GB saíram (achado 143); na onda 134 voltaram com o conteúdo da própria locadora (só com o dado dela).
  'pages/sobre/ui/SobrePage.web.tsx': 5,
}

/** Tags de abertura do JSX (do `<` ao `>` que fecha a tag, fora de chaves e de strings). */
function openingTags(source: string): string[] {
  const tags: string[] = []
  for (
    let start = source.indexOf('<');
    start !== -1;
    start = source.indexOf('<', start + 1)
  ) {
    if (!/[A-Za-z]/.test(source[start + 1] ?? '')) continue
    let depth = 0
    let quote: string | null = null
    for (let i = start + 1; i < source.length; i += 1) {
      const c = source[i]!
      if (quote) {
        if (c === '\\') i += 1
        else if (c === quote) quote = null
      } else if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      else if (c === '>' && depth === 0) {
        tags.push(source.slice(start, i + 1))
        break
      }
    }
  }
  return tags
}

const classTokens = (tag: string) =>
  (
    /className=(?:"([^"]*)"|\{`([^`]*)`\})/
      .exec(tag)
      ?.slice(1)
      .find((value) => value !== undefined) ?? ''
  ).split(/\s+/)

describe('revelação por rolagem: primeiro quadro com movimento reduzido', () => {
  it('a lista de elementos parados cobre os cartões vigentes, contato, CTA, títulos de seção e o hero', () => {
    expect(STILL_CLASSES).toEqual([
      'material-card',
      'benefit-card',
      'contact-form',
      'contact-info',
      'contact-card',
      'cta-section',
      'section-title',
      'section-subtitle',
      'hero-title',
      'hero-subtitle',
      'hero-search',
      'hero-buttons',
      'hero-contact',
      'hero-image',
    ])
  })

  it.each(Object.entries(SECTIONS))(
    '%s: escondido só em motion-safe, sem opacity-0 puro nem estilo inline',
    (file, hidden) => {
      const tags = openingTags(
        readFileSync(path.join(src, file), 'utf8')
      ).filter((tag) =>
        classTokens(tag).some((token) => STILL_CLASSES.includes(token))
      )
      expect(tags.length, file).toBeGreaterThanOrEqual(hidden)
      for (const tag of tags) {
        const tokens = classTokens(tag)
        expect(tokens, tag).not.toContain('opacity-0')
        expect(tag, tag).not.toMatch(/opacity:\s*0\b|translateY\(/)
      }
      expect(
        tags.filter((tag) => classTokens(tag).includes('motion-safe:opacity-0'))
          .length,
        file
      ).toBe(hidden)
    }
  )
})
