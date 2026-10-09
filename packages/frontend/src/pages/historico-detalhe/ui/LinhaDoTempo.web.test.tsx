import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Linha do tempo da locação', () => {
  it('pinta concluído de verde, atual de laranja e pendente de cinza', () => {
    const source = readFileSync(
      new URL('./LinhaDoTempo.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Linha do Tempo')
    expect(source).toContain(
      "step.status === 'completed' && 'bg-green-500 text-white'"
    )
    expect(source).toContain(
      "step.status === 'current' && 'bg-orange-500 text-white'"
    )
    expect(source).toContain(
      "step.status === 'pending' && 'bg-gray-200 text-gray-400'"
    )
    expect(source).toContain("case 'quote':")
    expect(source).toContain("case 'boleto':")
    expect(source).toContain("case 'paid':")
    expect(source).toContain(
      "boletoPayment.status === 'PAID' ? 'completed' : 'current'"
    )
    const page = readFileSync(
      new URL('./HistoricoDetalhePage.web.tsx', import.meta.url),
      'utf8'
    )
    expect(page).toContain("from './LinhaDoTempo.web'")
    expect(page).not.toContain('components/client/rental-timeline')
  })
})
