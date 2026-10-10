import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Layout da área do cliente', () => {
  it('mantém o menu, o login e o contador', () => {
    const source = readFileSync(
      new URL('./AreaCliente.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain("router.replace('/login')")
    expect(source).toContain("'notificationUpdate'")
    expect(source).toContain("localStorage.getItem('gb-locacoes-unread-count')")
    expect(source).toContain('const HEADER_HEIGHT = 104')
    expect(source).toContain("getElementById('dashboard-banner')")
    expect(source).toContain("['ADMIN', 'OPERATOR', 'FINANCIAL']")
    expect(source).toContain("label: 'Dashboard'")
    expect(source).toContain("label: 'Notificações'")
    expect(source).toContain("label: 'Meu Perfil'")
    expect(source).toContain("label: 'Meus Orçamentos'")
    expect(source).toContain("pathname.startsWith('/area-cliente/historico/')")
    expect(source).toContain("label: 'Endereços'")
    expect(source).toContain("label: 'Suporte'")
    expect(source).toContain("href: '/contato'")
    expect(source).toContain('href="/admin"')
    // A rota do host web mantém a composição compartilhada.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(public)/[locadora]/(account)/layout.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /import \{ AccountLayoutShell \} from ["']@gb-locacoes\/frontend\/app["']/
    )
    expect(webRoute).toContain(
      'return <AccountLayoutShell>{children}</AccountLayoutShell>'
    )
    const shell = readFileSync(
      new URL(
        '../../../app/providers/AccountLayoutShell.web.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(shell).toMatch(
      /import \{ AreaClienteLayout \} from ["']\.\.\/\.\.\/widgets\/cabecalho["']/
    )
    expect(shell).toContain('<AreaClienteLayout>{children}</AreaClienteLayout>')
  })
})
