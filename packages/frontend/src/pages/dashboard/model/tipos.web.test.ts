import { describe, expect, it } from 'vitest'
import {
  dashboardStatusConfig,
  mainStatsCards,
  quickActionButtons,
  statusStatsCards,
} from './tipos.web'
import type { DashboardStats } from './contratos'

describe('Configuração web do dashboard', () => {
  it('mantém os rótulos no singular e os atalhos existentes', () => {
    expect(
      Object.values(dashboardStatusConfig).map((status) => status.label)
    ).toEqual(['Pendente', 'Aprovado', 'Rejeitado', 'Concluído'])
    expect(mainStatsCards.map((card) => card.title)).toEqual([
      'Total de Equipamentos',
      'Categorias',
      'Orçamentos',
      'Receita Mensal',
    ])
    expect(mainStatsCards[1]?.subtitle(null)).toBe('Organizadas')
    expect(mainStatsCards[3]?.subtitle(null)).toBe('Este mês')
    expect(statusStatsCards.map((card) => card.title)).toEqual([
      'Pendentes',
      'Aprovados',
      'Rejeitados',
      'Concluídos',
    ])
    expect(quickActionButtons.map((button) => button.href)).toEqual([
      '/admin/equipamentos/novo',
      '/admin/categorias',
      '/admin/orcamentos',
    ])
  })

  it('apresenta zero sem dados e formata a receita em reais', () => {
    expect(mainStatsCards.map((card) => card.value(null))).toEqual([
      0,
      0,
      0,
      'R$ 0,00',
    ])
    expect(statusStatsCards.map((card) => card.value(null))).toEqual([
      0, 0, 0, 0,
    ])
    const stats: DashboardStats = {
      totalEquipments: 12,
      availableEquipments: 8,
      totalCategories: 3,
      totalQuotes: 20,
      pendingQuotes: 4,
      approvedQuotes: 10,
      rejectedQuotes: 2,
      completedQuotes: 4,
      totalRevenue: 10000,
      monthlyRevenue: 1234.56,
    }
    expect(mainStatsCards.map((card) => card.value(stats))).toEqual([
      12,
      3,
      20,
      'R$ 1.234,56',
    ])
    expect(mainStatsCards[0]?.subtitle(stats)).toBe('8 disponíveis')
    expect(mainStatsCards[2]?.subtitle(stats)).toBe('4 pendentes')
    expect(statusStatsCards.map((card) => card.value(stats))).toEqual([
      4, 10, 2, 4,
    ])
  })
})
