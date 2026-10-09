import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Métricas do dashboard', () => {
  it('mantém utilização, conversão e ticket com uma casa ou duas', () => {
    const source = readFileSync(
      new URL('./Metricas.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Taxa de Utilização')
    expect(source).toContain('Taxa de Conversão')
    expect(source).toContain('Ticket Médio')
    expect(source).toContain('utilizationRate?.toFixed(1) || 0')
    expect(source).toContain('conversionRate?.toFixed(1) || 0')
    expect(source).toContain('Math.min(stats?.utilizationRate || 0, 100)')
    expect(source).toContain('Math.min(stats?.conversionRate || 0, 100)')
    expect(source).toContain('disponíveis')
    expect(source).toContain('orçamentos')
    expect(source).toContain('Valor médio por orçamento')
    expect(source).toContain("toLocaleString('pt-BR'")
    expect(source).toContain("|| '0,00'")
    expect(source).toContain('grid-cols-1 md:grid-cols-3')
    expect(source).toContain('delay: 0.8')
    expect(source).toContain('delay: 0.85')
    expect(source).toContain('delay: 0.5')
  })
})
