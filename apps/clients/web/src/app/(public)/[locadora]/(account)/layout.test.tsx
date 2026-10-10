// Onda 135 (A5; E13 do plano de aposentadoria da raiz): a área do cliente no host da locadora monta a moldura da área
// do cliente (AccountLayoutShell, camada app do frontend), preservando a composição do antigo app/area-cliente/layout.tsx,
// retirado com a raiz em F. Em
// `legacy` (NextAuth) a área continua oculta (desenho 4.6).
import { afterEach, describe, expect, it, vi } from 'vitest'

const shell = vi.hoisted(() => ({
  AccountLayoutShell: ({ children }: { children: unknown }) => children,
}))
vi.mock('@gb-locacoes/frontend/app', () => shell)

import TenantAccountLayout, { metadata } from './layout'

afterEach(() => vi.unstubAllEnvs())

describe('layout (account) da locadora', () => {
  it.each(['better-auth', 'better-auth-v2'])(
    '%s: a página entra na moldura da área do cliente',
    (mode) => {
      vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', mode)
      const element = TenantAccountLayout({ children: 'perfil' })
      expect(element.type).toBe(shell.AccountLayoutShell)
      expect(element.props).toEqual({ children: 'perfil' })
    }
  )

  it('legacy: o 404 neutro, sem moldura', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'legacy')
    expect(() => TenantAccountLayout({ children: 'perfil' })).toThrow(
      expect.objectContaining({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    )
  })

  it('a área do cliente nunca é indexada', () => {
    expect(metadata).toEqual({ robots: { index: false, follow: false } })
  })
})
