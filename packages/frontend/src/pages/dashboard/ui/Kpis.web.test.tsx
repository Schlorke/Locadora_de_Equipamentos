import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('KPIs financeiros do dashboard', () => {
  it('mantém os cinco cartões, o atraso vermelho e o lucro pelo sinal', () => {
    const source = readFileSync(
      new URL('./Kpis.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Receita Mensal (MRR)')
    expect(source).toContain('Utilização da Frota')
    expect(source).toContain('Valor em Atraso')
    expect(source).toContain('Ticket Médio')
    expect(source).toContain('Lucro Líquido')
    expect(source).toContain("toLocaleString('pt-BR'")
    expect(source).toContain('fleetUtilization.toFixed(1)')
    expect(source).toContain("valueColor: 'text-red-600'")
    expect(source).toContain(
      "metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'"
    )
    expect(source).toContain('trendLabel="vs. mês anterior"')
    expect(source).toContain('lg:grid-cols-5')
    expect(source).toContain('delay: 0.3 + index * 0.05')
  })
})
