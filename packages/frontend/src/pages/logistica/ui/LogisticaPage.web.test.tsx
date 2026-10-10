import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Logística admin', () => {
  it('mantém o título, entrega, coleta e as cores', () => {
    const source =
      readFileSync(
        new URL('./LogisticaPage.web.tsx', import.meta.url),
        'utf8'
      ) + readFileSync(new URL('../model/calendar.ts', import.meta.url), 'utf8')
    expect(source).toContain('title="Gerenciar Logística"')
    expect(source).toContain('subtitle="Entregas e coletas de equipamentos"')
    expect(source).toContain('title="Calendário de Logística"')
    expect(source).toContain("? 'Entrega' : 'Coleta'")
    expect(source).toContain('Sem veículo • Entregas')
    expect(source).toContain('#3B82F6')
    expect(source).toContain('#8B5CF6')
    expect(source).toContain('addHours(now, 2)')
    // A rota do host web mantém a composição compartilhada.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(admin)/admin/logistics/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/logistica["']/
    )
    expect(webRoute).toContain('return <AdminLogisticsPage />')
  })
})
