import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Destaques do dashboard', () => {
  it('mantém o top 10, o sinal do ROI e a média mesmo em zero', () => {
    const source = readFileSync(
      new URL('./Destaques.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Equipamentos Mais Solicitados')
    expect(source).toContain('ROI por Equipamento (Top 10)')
    expect(source).toContain('Receita Média por Equipamento')
    expect(source).toContain('Média de receita por equipamento no período')
    expect(source).toContain(
      'stats?.topEquipments && stats.topEquipments.length > 0'
    )
    expect(source).toContain('requestCount || 1')
    expect(source).toContain('.sort((a, b) => b.roi - a.roi)')
    expect(source).toContain('.slice(0, 10)')
    expect(source).toContain('roi || 1')
    expect(source).toContain("equipment.roi > 0 ? '+' : ''")
    expect(source).toContain('equipment.roi.toFixed(1)')
    expect(source).toContain('text-green-600')
    expect(source).toContain('text-red-600')
    expect(source).toContain('text-gray-600')
    expect(source).toContain('averageRevenuePerEquipment !== undefined')
    expect(source).toContain("toLocaleString('pt-BR'")
    expect(source).toContain('solicitações')
  })
})
