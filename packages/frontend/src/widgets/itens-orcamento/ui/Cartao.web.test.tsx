import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Cartão de itens do orçamento', () => {
  it('mantém adicionar, remover e a justificativa do ajuste', () => {
    const source = readFileSync(
      new URL('./Cartao.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('aria-label="Adicionar equipamento ao orçamento"')
    expect(source).toContain('Adicionar equipamento em desenvolvimento')
    expect(source).toContain('Adicionar equipamento')
    expect(source).toContain('aria-label="Remover item do orçamento"')
    expect(source).toContain('aria-label="Remover reajuste do orçamento"')
    expect(source).toContain('Justificativa do Ajuste')
    const panel = readFileSync(
      new URL(
        '../../../pages/orcamentos-admin/ui/Painel.web.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(panel).toContain('widgets/itens-orcamento')
  })
})
