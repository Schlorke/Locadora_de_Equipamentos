import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Abas de categoria', () => {
  it('anuncia as sessões e recebe o rótulo de cada aba', () => {
    const source = readFileSync(
      new URL('./Abas.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain(
      'aria-label="Sessões de categorias de equipamentos"'
    )
    expect(source).toContain('{section.label}')
    expect(source).toContain('aria-labelledby={`${activeSection.value}-tab`}')
    expect(source).toContain('export type TabConfig')
    expect(source).toContain('export function CategoryShowcase')
  })
})
