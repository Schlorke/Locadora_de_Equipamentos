import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Manutenção admin', () => {
  it('mantém o título, o teto de 24 horas e as cores por tipo', () => {
    const source =
      readFileSync(
        new URL('./ManutencaoPage.web.tsx', import.meta.url),
        'utf8'
      ) + readFileSync(new URL('../model/calendar.ts', import.meta.url), 'utf8')
    expect(source).toContain('title="Gerenciar Manutenções"')
    expect(source).toContain(
      'subtitle="Agenda e histórico de manutenções de equipamentos"'
    )
    expect(source).toContain('title="Calendário de Manutenções"')
    expect(source).toContain('addHours(start, 4)')
    expect(source).toContain('addHours(start, 24)')
    expect(source).toContain("maintenance.type === 'PREVENTIVE'")
    expect(source).toContain('#10B981')
    expect(source).toContain("maintenance.type === 'CORRECTIVE'")
    expect(source).toContain('#F59E0B')
    expect(source).toContain('#6366F1')
    expect(source).toContain("type: 'maintenance'")
    const route = readFileSync(
      new URL(
        '../../../../../../app/admin/maintenance/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(route).toContain("from '@gb-locacoes/frontend/pages/manutencao'")
    expect(route).toContain('return <AdminMaintenancePage />')
    // Onda 135 (A8): a mesma página no host web; a asserção sobre a raiz sai no bloco F.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(admin)/admin/maintenance/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/manutencao["']/
    )
    expect(webRoute).toContain('return <AdminMaintenancePage />')
  })
})
