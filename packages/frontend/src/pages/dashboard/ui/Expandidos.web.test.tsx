import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Painéis expandidos do dashboard', () => {
  it('abre os sete cartões fora do SSR e passa a prop expandida', () => {
    const source = readFileSync(
      new URL('./Expandidos.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain("expandedCardId === 'tendencia-orcamentos'")
    expect(source).toContain("expandedCardId === 'distribuicao-status'")
    expect(source).toContain(
      "expandedCardId === 'evolucao-receita' && revenueData"
    )
    expect(source).toContain(
      "expandedCardId === 'receita-categoria-dash' && revenueData"
    )
    expect(source).toContain(
      "expandedCardId === 'aging-contas-dash' && agingData"
    )
    expect(source).toContain(
      "expandedCardId === 'maiores-devedores-dash' && agingData"
    )
    expect(source).toContain("expandedCardId === 'distribuicao-categoria'")
    expect(source).toContain('stats?.equipmentByCategory')
    expect(source).toContain('stats?.quotesTrend ?? []')
    expect(source).toContain('stats?.totalQuotes ?? 0')
    expect(source).toContain('ssr: false')
    expect(source).toContain('expanded')
    expect(source).toContain('defaultColor="#3b82f6"')
  })
})
