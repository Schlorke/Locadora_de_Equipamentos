import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Carga de notificações', () => {
  it('conserva contratos na implementação compartilhada e contador apenas no web', () => {
    const web = readFileSync(
      new URL('./use-notifications.web.ts', import.meta.url),
      'utf8'
    )
    const source = readFileSync(
      new URL('./use-notifications-model.ts', import.meta.url),
      'utf8'
    )
    const contract = readFileSync(
      new URL('./notification-contract.ts', import.meta.url),
      'utf8'
    )
    const native = readFileSync(
      new URL('./use-notifications.native.ts', import.meta.url),
      'utf8'
    )
    expect(web).toContain("const UNREAD_COUNT_KEY = 'gb-locacoes-unread-count'")
    expect(web).toContain("new CustomEvent('notificationUpdate'")
    expect(source).toContain("session?.user?.role !== 'ADMIN'")
    expect(source).toContain("'/api/admin/notifications/sync'")
    expect(source).toContain("'/api/client/notifications?limit=50'")
    expect(source).toContain("throw new Error('Erro ao carregar notificações')")
    expect(source).toContain('encodeURIComponent(notificationId)')
    expect(source).toContain("method: 'PATCH'")
    expect(source).toContain("method: 'DELETE'")
    expect(source).toContain("'/api/client/notifications/mark-all-read'")
    expect(source).toContain(
      "throw new Error('Erro ao marcar todas como lidas')"
    )
    expect(source).toContain("throw new Error('Erro ao remover notificação')")
    expect(source).toContain('Math.max(0, s.stats.unread - 1)')
    expect(source).toContain('unread: 0, byType: {}')
    expect(source).toContain('apiNotif.type.toLowerCase()')
    expect(source).toContain('apiNotif.priority.toLowerCase()')
    expect(contract).toContain('export interface NotificationStats')
    expect(source).toContain('Por ora, apenas limpa localmente')
    expect(source).not.toMatch(/\b(fetch|window|localStorage|CustomEvent)\(/)
    expect(native).not.toMatch(/web|window|localStorage|CustomEvent/)
  })
})
