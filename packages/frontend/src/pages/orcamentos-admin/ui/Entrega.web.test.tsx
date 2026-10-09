import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Cartão de entrega do orçamento', () => {
  it('esconde o cartão sem entrega, omite frete com ajuste TRAVEL e marca retirada', () => {
    const source = readFileSync(
      new URL('./Entrega.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain(
      'if (!selectedQuote.deliveryType && !selectedQuote.deliveryAddress)'
    )
    expect(source).toContain('return null')
    expect(source).toContain('Entrega / Retirada')
    expect(source).toContain('Entrega no Endereço')
    expect(source).toContain('Cliente retirará os equipamentos na loja')
    expect(source).toContain("a.category === 'TRAVEL'")
    expect(source).toContain('selectedQuote.deliveryFee > 0')
    expect(source).toContain('Valor do Frete')
    expect(source).toContain('(calculado pelo sistema)')
    expect(source).toContain('deliveryFee ?? 0')
    expect(source).toContain("from '../../../shared/lib/formatting'")
    expect(source).toContain('Endereço de Entrega')
    expect(source).toContain('aria-label="Editar entrega e endereço"')
    expect(source).toContain("deliveryType === 'PICKUP'")
  })
})
