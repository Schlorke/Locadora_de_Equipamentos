import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Dados da listagem e do detalhe de orçamentos', () => {
  it('mantém a busca paginada e o kanban sem filtro de status', () => {
    const dados =
      readFileSync(new URL('./dados.ts', import.meta.url), 'utf8') +
      readFileSync(new URL('./dados.web.ts', import.meta.url), 'utf8')
    const detalhe =
      readFileSync(new URL('./detalhe.ts', import.meta.url), 'utf8') +
      readFileSync(new URL('./detalhe.web.ts', import.meta.url), 'utf8')
    const lista = readFileSync(
      new URL('../ui/Lista.web.tsx', import.meta.url),
      'utf8'
    )
    expect(dados).toContain('const pageSize = 20')
    expect(dados).toContain("limit: isKanban ? '500' : String(pageSize)")
    expect(dados).toContain("page: isKanban ? '1' : String(currentPage)")
    expect(dados).toContain('statusFilter.toUpperCase()')
    expect(dados).toContain("if (!isKanban && statusFilter !== 'all')")
    expect(dados).toContain("if (!isKanban && periodFilter !== 'all')")
    expect(dados).toContain("params.append('valueRange', valueFilter)")
    expect(dados).toContain('quoteApi.list(String(params),')
    expect(dados).toContain('quoteApi.get(quoteId)')
    expect(dados).toContain("searchParams.get('search')")
    expect(dados).toContain('Erro ao carregar orçamentos. Tente novamente.')
    expect(dados).toContain("from '../../../entities/orcamento'")
    expect(dados).not.toContain('../packages/frontend')
    expect(detalhe).toContain('includeWeekends: false')
    expect(detalhe).toContain('countDaysBetween(start, end, includeWeekends)')
    expect(detalhe.replace(/\s+/g, '')).toContain(
      'quoteApi.adjustments(selectedQuote.id)'
    )
    expect(detalhe).toContain('Email é obrigatório')
    expect(detalhe).toContain('Telefone é obrigatório')
    expect(detalhe).toContain('Data início e data fim são obrigatórias')
    expect(detalhe).toContain('Tipo de operação salvo')
    expect(detalhe).toContain('Dados do cliente atualizados')
    expect(detalhe).toContain('Período do item atualizado')
    expect(detalhe).toContain('Entrega e endereço atualizados')
    expect(detalhe).toContain('Item removido do orçamento')
    expect(detalhe).toContain("from '../../../features/selos-admin'")
    expect(detalhe).toContain("from '../../../entities/orcamento'")
    expect(detalhe).not.toContain('../packages/frontend')
    expect(lista).toContain("from '../model/dados.web'")
    expect(lista).toContain("from '../model/detalhe.web'")
    expect(lista).not.toContain('@/hooks/use-quotes-data')
    expect(lista).not.toContain('@/hooks/use-quote-details')
  })
})
