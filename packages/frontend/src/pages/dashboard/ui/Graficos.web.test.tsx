import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Gráficos do dashboard', () => {
  it('mantém títulos, espera e o carregamento fora do SSR', () => {
    const source = readFileSync(
      new URL('./Graficos.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Tendência de Orçamentos (7 dias)')
    expect(source).toContain('Distribuição de Status')
    expect(source).toContain('Evolução da Receita (Últimos 12 meses)')
    expect(source).toContain('Receita por Categoria')
    expect(source).toContain('Aging de Contas a Receber')
    expect(source).toContain('Maiores Devedores')
    expect(source).toContain('Distribuição por Categoria')
    expect(source).toContain('id="tendencia-orcamentos"')
    expect(source).toContain('id="distribuicao-status"')
    expect(source).toContain('id="evolucao-receita"')
    expect(source).toContain('id="receita-categoria-dash"')
    expect(source).toContain('id="aging-contas-dash"')
    expect(source).toContain('id="maiores-devedores-dash"')
    expect(source).toContain('id="distribuicao-categoria"')
    expect(source).toContain('ssr: false')
    expect(source).toContain('h-[300px]')
    expect(source).toContain('h-[200px]')
    expect(source).toContain('stats?.quotesTrend ?? []')
    expect(source).toContain('stats?.totalQuotes ?? 0')
    expect(source).toContain('stats.equipmentByCategory.length > 0')
    expect(source).toContain('defaultColor="#3b82f6"')
  })
})
