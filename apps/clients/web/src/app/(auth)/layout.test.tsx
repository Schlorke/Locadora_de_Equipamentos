// @vitest-environment jsdom
// Fluxos de conta no host `app` (console da plataforma): a casca é a da plataforma, não a da vitrine. Antes o layout
// montava o cabeçalho, o rodapé e o WhatsApp da vitrine (marca GB, links Início/Equipamentos/Orçamento/Contato que
// dão 404 no host `app`).
import { cleanup, render, screen } from '@testing-library/react'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ pathname: '/login' }))
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('../../host/auth/client', () => ({
  hostAuth: {
    getSession: vi.fn(async () => null),
    signInCredentials: vi.fn(),
    signInProvider: vi.fn(),
    signOut: vi.fn(async () => undefined),
  },
}))

import AppAuthLayout from './layout'

afterEach(cleanup)

describe('layout (auth) do host app', () => {
  it.each(['/login', '/recuperar-senha', '/reset-password', '/auth/callback', '/admin/login'])(
    '%s: casca da plataforma com o nome provisório, sem navegação, rodapé e WhatsApp da vitrine',
    async (pathname) => {
      nav.pathname = pathname
      render(
        <AppAuthLayout>
          <p>Tela de conta</p>
        </AppAuthLayout>
      )
      expect(await screen.findByText('Tela de conta')).toBeTruthy()
      expect(screen.getByRole('banner').textContent).toBe(PLATFORM.displayName)
      expect(screen.getByRole('main').textContent).toBe('Tela de conta')
      expect(screen.queryAllByRole('link')).toEqual([])
      expect(screen.queryByRole('navigation')).toBeNull()
      expect(screen.queryByRole('contentinfo')).toBeNull()
      expect(document.body.textContent).not.toContain('GB')
      expect(document.body.innerHTML).not.toMatch(/whats\s*app/i)
      // Sem a reserva de altura do cabeçalho fixo da vitrine.
      expect(document.body.innerHTML).not.toContain('--header-offset')
    }
  )
})
