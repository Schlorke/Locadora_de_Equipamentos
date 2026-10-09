import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Diálogo de reajuste do orçamento', () => {
  it('mantém categorias, validação e o total somado ao valor original', () => {
    const source = readFileSync(
      new URL('./Reajuste.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Registrar Reajuste de Orçamento')
    expect(source).toContain('e-mail e WhatsApp')
    expect(source).toContain('Valor Original do Orçamento')
    expect(source).toContain('value="LABOR"')
    expect(source).toContain('Mão de obra')
    expect(source).toContain('value="TRAVEL"')
    expect(source).toContain('Deslocamento (Frete)')
    expect(source).toContain('value="MAINTENANCE"')
    expect(source).toContain('Manutenção')
    expect(source).toContain('value="OTHER"')
    expect(source).toContain('Outro')
    expect(source).toContain('usedByOtherItems.includes')
    expect(source).toContain('Selecione a categoria')
    expect(source).toContain('Ex: Taxa de portaria, Taxa administrativa...')
    expect(source).toContain(
      'Ex: Taxa de quebra/avaria, ajuste por perdas de peças, etc.'
    )
    expect(source).toContain('Adicionar reajuste')
    expect(source).toContain('aria-label="Remover item de reajuste"')
    expect(source).toContain("items.length === 1 ? 'item' : 'itens'")
    expect(source).toContain('Novo valor final')
    expect(source).toContain('originalAmount + totalAdjustments')
    expect(source).toContain('Number.isFinite(i.value) ? i.value : 0')
    expect(source).toContain('item.value <= 0')
    expect(source).toContain('isEditing = false')
    expect(source).toContain(
      "isSubmitting ? 'Registrando...' : 'Registrar Reajuste'"
    )
    expect(source).toContain('variant="outline"')
    expect(source).toContain('variant="default"')
    expect(source).toContain("from '../../../entities/orcamento'")
  })
})
