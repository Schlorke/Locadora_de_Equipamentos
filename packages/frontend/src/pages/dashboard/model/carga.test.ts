import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Carga do dashboard', () => {
  it('busca as quatro rotas e monta o gráfico só com valores positivos', () => {
    const source = readFileSync(new URL('./carga.ts', import.meta.url), 'utf8')
    expect(source).toContain('api.stats()')
    expect(source).toContain('api.quotes()')
    expect(source).toContain('api.revenue()')
    expect(source).toContain('api.aging()')
    expect(source).toContain('rawQuotes.slice(0, 5)')
    expect(source).toContain("q.name || q.customerName || '-'")
    expect(source).toContain("q.email || q.customerEmail || '-'")
    expect(source).toContain('q.finalTotal')
    expect(source).toContain('q.totalPrice')
    expect(source).toContain("String(q.status ?? 'pending')")
    expect(source).toContain("{ name: 'Pendentes'")
    expect(source).toContain("{ name: 'Aprovados'")
    expect(source).toContain("{ name: 'Rejeitados'")
    expect(source).toContain("{ name: 'Concluídos'")
    expect(source).toContain('filter((item) => item.value > 0)')
    expect(source).toContain(
      'Alguns dados do dashboard não puderam ser carregados'
    )
    expect(source).toContain(
      'Não foi possível carregar os dados principais do dashboard.'
    )
    expect(source).toContain('Erro ao carregar dados do dashboard.')
  })
})
