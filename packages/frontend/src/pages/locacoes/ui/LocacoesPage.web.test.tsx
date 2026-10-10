import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Locações admin', () => {
  it('mantém o título, o período e as cores de status', () => {
    const source = readFileSync(
      new URL('./LocacoesPage.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('title="Gerenciar Locações"')
    expect(source).toContain(
      'Visualize e gerencie todas as locações de equipamentos'
    )
    expect(source).toContain("PENDING: '#F97316'")
    expect(source).toContain("ACTIVE: '#3B82F6'")
    expect(source).toContain("COMPLETED: '#10B981'")
    expect(source).toContain("CANCELLED: '#EF4444'")
    expect(source).toContain("OVERDUE: '#FBBF24'")
    expect(source).toContain("PENDING_RETURN: '#8B5CF6'")
    expect(source).toContain("|| '#6B7280'")
    expect(source).toContain('isPending && createdAt ? createdAt')
    expect(source).toContain(
      'placeholder="Buscar por cliente, email, telefone, empresa..."'
    )
    expect(source).toContain("label: 'Hoje'")
    expect(source).toContain("label: 'Última semana'")
    expect(source).toContain("label: 'Último mês'")
    // A rota do host web mantém a composição compartilhada.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(admin)/admin/rentals/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/locacoes["']/
    )
    expect(webRoute).toContain('return <AdminRentalsPage />')
  })
})
