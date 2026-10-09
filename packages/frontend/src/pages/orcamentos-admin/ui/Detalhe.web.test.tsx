import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Detalhe admin do orçamento', () => {
  it('busca o orçamento, volta e formata o total sem o formatador da tabela', () => {
    const source = readFileSync(
      new URL('./Detalhe.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('quoteApi.get<Quote>(id)')
    expect(source).toContain('Orçamento não encontrado')
    expect(source).toContain('Erro ao carregar orçamento')
    expect(source).toContain("router.push('/admin/orcamentos')")
    expect(source).toContain("console.error('Error fetching quote:', error)")
    expect(source).toContain('router.back()')
    expect(source).toContain('Voltar para Orçamentos')
    expect(source).toContain('Orçamento {quote.quoteCode || quote.id}')
    expect(source).toContain('Detalhes completos do orçamento')
    expect(source).toContain('Informações do Cliente')
    expect(source).toContain('Detalhes da Locação')
    expect(source).toContain('Equipamentos ({quote.items.length})')
    expect(source).toContain("pending: 'Pendente'")
    expect(source).toContain("approved: 'Aprovado'")
    expect(source).toContain("rejected: 'Rejeitado'")
    expect(source).toContain("completed: 'Concluído'")
    expect(source).toContain("toLocaleString('pt-BR'")
    expect(source).toContain("style: 'currency'")
    expect(source).toContain("currency: 'BRL'")
    expect(source).toContain('{item.days} dias')
    expect(source).toContain('Código Legado')
    expect(source).toContain('<img')
    expect(source).not.toContain('formatCurrency')
    expect(source).not.toContain('quotes/types')
    expect(source).toContain('params: Promise<{ id: string }>')
  })
})
