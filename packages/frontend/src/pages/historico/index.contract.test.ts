import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('contrato historico', () => {
  it('exporta HistoricoPage pelo index público do slice', () => {
    const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(index).toContain(
      "export { HistoricoPage } from './ui/HistoricoPage'"
    )
  })
})
