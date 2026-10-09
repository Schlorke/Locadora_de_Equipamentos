import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('contrato orcamento', () => {
  it('exporta QuotePageWrapper pelo index público do slice', () => {
    const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(index).toMatch(
      /export \{ QuotePageWrapper \} from ['"]\.\/ui\/OrcamentoPage['"]/
    )
    const facade = readFileSync(
      new URL('./ui/OrcamentoPage.tsx', import.meta.url),
      'utf8'
    )
    expect(facade).toMatch(
      /export \{ QuotePageWrapper \} from ['"]\.\/OrcamentoPage\.web['"]/
    )
    const native = readFileSync(
      new URL('./ui/OrcamentoPage.native.tsx', import.meta.url),
      'utf8'
    )
    expect(native).toContain('export function QuotePageWrapper')
  })

  it('exporta QuoteForm pelo index público do slice', () => {
    const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(index).toContain('QuoteForm')
  })
})
