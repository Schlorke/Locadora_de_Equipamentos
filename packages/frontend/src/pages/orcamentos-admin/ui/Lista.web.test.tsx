import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Listagem admin de orçamentos', () => {
  it('mantém filtros, views e o atalho para o financeiro', () => {
    const source = readFileSync(
      new URL('./Lista.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Gerenciar Orçamentos')
    expect(source).toContain(
      'Visualize, analise e gerencie todos os orçamentos solicitados'
    )
    expect(source).toContain(
      'Buscar por cliente, código do orçamento, e-mail...'
    )
    expect(source).toContain("{ value: 'pending', label: 'Pendentes' }")
    expect(source).toContain("{ value: 'approved', label: 'Aprovados' }")
    expect(source).toContain("{ value: 'rejected', label: 'Rejeitados' }")
    expect(source).toContain("{ value: 'completed', label: 'Concluidos' }")
    expect(source).toContain("viewMode !== 'kanban'")
    expect(source).toContain("if (value === 'kanban') setPeriodFilter('all')")
    expect(source).toContain("{ value: 'low', label: 'Até R$ 500' }")
    expect(source).toContain("{ value: 'medium', label: 'R$ 500 - R$ 2.000' }")
    expect(source).toContain("{ value: 'high', label: 'Acima de R$ 2.000' }")
    expect(source).toContain(
      'Não foi possível gerar busca no financeiro para este orçamento.'
    )
    expect(source).toContain('quote.quoteCode ||')
    expect(source).toContain('quote.legacyExternalCode ||')
    expect(source).toContain(
      'router.push(`/admin/financeiro?${query.toString()}`)'
    )
    expect(source).toContain("query.set('quoteId', quote.id)")
    expect(source).toContain("from '../../../widgets/filtro-admin'")
    expect(source).toContain("from './Kanban.web'")
    expect(source).toContain("from './Tabela.web'")
    expect(source).toContain("from './Calendario.web'")
    expect(source).toContain("from './Painel.web'")
    expect(source).not.toContain('@gb-locacoes/frontend/pages/orcamentos-admin')
    expect(source).not.toContain('../../packages/frontend')
    expect(source).toContain('<Suspense fallback={null}>')
  })
})
