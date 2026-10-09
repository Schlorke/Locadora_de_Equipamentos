// @vitest-environment jsdom
// /admin/login no host `app` (achado 25): "Sair" do painel e /admin sem sessão chegam aqui; a página segue para o
// login da equipe em vez de ficar no "Redirecionando..." para sempre.
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: '' }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))

import { ADMIN_LOGIN_REDIRECT } from '@gb-locacoes/frontend/pages/admin-login'
import Page from './page'

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('/admin/login no host app', () => {
  it('mostra o aviso e segue para o login da equipe', async () => {
    nav.search = ''
    render(<Page />)
    expect(screen.getByText('Redirecionando...')).toBeTruthy()
    await waitFor(() => expect(nav.replace).toHaveBeenCalledTimes(1))
    expect(nav.replace).toHaveBeenCalledWith(ADMIN_LOGIN_REDIRECT)
    expect(ADMIN_LOGIN_REDIRECT).toBe('/login')
  })

  it('repassa o callback ao login, que só aceita rotas do painel', async () => {
    nav.search = '?callbackUrl=' + encodeURIComponent('/admin/rentals?status=ativo')
    render(<Page />)
    await waitFor(() => expect(nav.replace).toHaveBeenCalledTimes(1))
    expect(nav.replace).toHaveBeenCalledWith('/login?callbackUrl=' + encodeURIComponent('/admin/rentals?status=ativo'))
  })
})
