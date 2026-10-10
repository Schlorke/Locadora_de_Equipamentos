import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Página de notificações', () => {
  it('mantém rótulos, tempo e o contador local', () => {
    const source = readFileSync(
      new URL('./NotificacoesPage.web.tsx', import.meta.url),
      'utf8'
    )
    const model = readFileSync(
      new URL('../model/notification-presentation.ts', import.meta.url),
      'utf8'
    )
    expect(source).toContain("localStorage.setItem('gb-locacoes-unread-count'")
    expect(source).toContain("new CustomEvent('notificationUpdate'")
    expect(model).toContain("return 'Orçamento'")
    expect(model).toContain("return 'Equipamento'")
    expect(model).toContain("return 'Pagamento'")
    expect(model).toContain("return 'Sistema'")
    expect(model).toContain("return 'Geral'")
    expect(source).toContain('return CheckCircle')
    expect(source).toContain('return Settings')
    expect(source).toContain('return AlertCircle')
    expect(source).toContain('return Bell')
    expect(model).toContain("return 'Agora mesmo'")
    expect(model).toContain('return `${diffInMinutes}m atrás`')
    expect(model).toContain('diffInMinutes < 1440')
    expect(source).toContain("split('\\nMotivo:')")
    expect(source).toContain("split(' Motivo:')")
    expect(source).toContain('Falha ao remover notificação. Tente novamente.')
    expect(source).toContain('Lido')
    expect(source).toContain('Ver')
    expect(source).toContain('Lista de Notificações')
    expect(source).toContain('Carregando notificações...')
    expect(source).toContain('notificação(ões) encontrada(s)')
    expect(source).toContain('Nenhuma notificação')
    expect(source).toContain(
      'Você está em dia! Novas notificações aparecerão aqui.'
    )
    expect(source).toContain(
      'Mantenha-se atualizado com todas as suas notificações'
    )
    expect(source).toContain('pt-[84px]')
    expect(source).toContain('#f9fafb')
    // A rota do host web mantém a composição compartilhada.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(public)/[locadora]/(account)/area-cliente/notificacoes/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/notificacoes["']/
    )
    expect(webRoute).toContain('return <NotificacoesPage />')
  })
})
