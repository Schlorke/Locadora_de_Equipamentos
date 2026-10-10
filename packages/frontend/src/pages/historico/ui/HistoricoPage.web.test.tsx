import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Histórico do cliente', () => {
  it('mantém a busca, o filtro e os vínculos das rotas', () => {
    const source = readFileSync(
      new URL('./HistoricoPage.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('searchPlaceholder="Buscar por equipamento..."')
    expect(source).toContain("label: 'Todos os status'")
    expect(source).toContain("value: 'all'")
    expect(source).toContain('Meus Orçamentos')
    // A rota do host web mantém a composição compartilhada.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(public)/[locadora]/(account)/area-cliente/historico/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/historico["']/
    )
    expect(webRoute).toContain('return <HistoricoPage />')
  })
})
