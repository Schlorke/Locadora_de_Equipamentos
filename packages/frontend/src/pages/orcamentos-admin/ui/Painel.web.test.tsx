import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Painel de detalhe do orçamento', () => {
  it('mostra o título, rejeita e aprova sem unificar o cartão de itens', () => {
    const source = readFileSync(
      new URL('./Painel.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Detalhes do Orçamento -')
    expect(source).toContain('Rejeitar Orçamento')
    expect(source).toContain('Aprovar e Converter')
    expect(source).toContain('Aprovar Orçamento')
    expect(source).toContain('getInitials')
    expect(source).toContain("from '../../../shared/lib/formatting'")
    expect(source).toContain('../../../widgets/itens-orcamento')
    expect(source).not.toContain('../../packages/frontend')
    expect(source).toContain("from './Cliente.web'")
    expect(source).toContain("from './Entrega.web'")
    expect(source).toContain("from './Boleto.web'")
    expect(source).toContain("from './Rejeicao.web'")
    expect(source).toContain("from './Rejeitar.web'")
    expect(source).toContain("from './Excluir.web'")
    expect(source).toContain("from './RemoverAprovacao.web'")
    expect(source).toContain("from './RemoverItem.web'")
    expect(source).toContain("from './RemoverReajuste.web'")
    expect(source).toContain("from './Multa.web'")
    expect(source).toContain("from './EditarCliente.web'")
    expect(source).toContain("from './EditarEntrega.web'")
    expect(source).toContain("from './EditarPeriodo.web'")
    expect(source).toContain("from './Reajuste.web'")
    expect(source).not.toContain("from './utils'")
  })
})
