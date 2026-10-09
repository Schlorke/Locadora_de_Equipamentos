import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('contrato migração pages/historico-detalhe', () => {
  it('exporta RentalDetailsPage pelo index público do slice', () => {
    const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(index).toContain('export { RentalDetailsPage }')
    expect(index).toContain("from './ui/HistoricoDetalhePage'")
  })
})
