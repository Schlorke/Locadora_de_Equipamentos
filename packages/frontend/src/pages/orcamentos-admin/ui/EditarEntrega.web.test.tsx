import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Diálogo de editar entrega do orçamento', () => {
  it('separa entrega e retirada e zera o frete na retirada', () => {
    const source = readFileSync(
      new URL('./EditarEntrega.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Editar entrega e endereço')
    expect(source).toContain('value="DELIVERY"')
    expect(source).toContain('Entrega no Endereço')
    expect(source).toContain('value="PICKUP"')
    expect(source).toContain('Retirada em Loja')
    expect(source).toContain("value === 'PICKUP' ? { deliveryFee: '' }")
    expect(source).toContain('Valor do frete (R$)')
    expect(source).toContain('placeholder="00000-000"')
    expect(source).toContain('formatCEP')
    expect(source).toContain('Cancelar')
    expect(source).toContain("isSaving ? 'Salvando...' : 'Salvar'")
    expect(source).toContain('variant="outline"')
    expect(source).toContain('variant="default"')
    expect(source).toContain('aria-label="Fechar dialog"')
  })
})
