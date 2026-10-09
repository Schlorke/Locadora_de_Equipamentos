import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Gráficos financeiros', () => {
  it('mantém as cores do aging e das categorias', () => {
    const aging = readFileSync(
      new URL('./AgingChart.web.tsx', import.meta.url),
      'utf8'
    )
    const category = readFileSync(
      new URL('./RevenueByCategoryChart.web.tsx', import.meta.url),
      'utf8'
    )
    expect(aging).toContain("current: '#16A34A'")
    expect(aging).toContain("slight: '#D97706'")
    expect(aging).toContain("moderate: '#EA580C'")
    expect(aging).toContain("severe: '#DC2626'")
    expect(aging).toContain("critical: '#991B1B'")
    expect(aging).toContain("onTime: '#16A34A'")
    expect(aging).toContain("slightDelay: '#D97706'")
    expect(aging).toContain("severeDelay: '#DC2626'")
    expect(aging).toContain("|| '#94a3b8'")
    expect(category).toContain("'#3b82f6'")
    expect(category).toContain("'#22c55e'")
    expect(category).toContain("'#f59e0b'")
    expect(category).toContain("'#8b5cf6'")
    expect(category).toContain("'#06b6d4'")
    expect(category).toContain("'#ec4899'")
  })
})
