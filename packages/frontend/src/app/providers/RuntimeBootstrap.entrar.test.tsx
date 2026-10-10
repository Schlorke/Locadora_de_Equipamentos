// @vitest-environment jsdom
// Achado 114 da revisão adversarial: o login da área privada ("Entrar" e a troca automática do painel) usa a regra
// única `signInHref` de features/entrar, pelo index público da feature, em vez de uma cópia local no RuntimeBootstrap.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders, PrivateAreaGate, type HttpClient } from '../index.web'

const rule = vi.hoisted(() => ({ signInHref: vi.fn() }))

vi.mock('../../features/entrar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/entrar')>()
  rule.signInHref.mockImplementation(actual.signInHref)
  return { ...actual, signInHref: rule.signInHref }
})

const apiClient: HttpClient = {
  async request<T>(path: string) {
    return (
      path === '/api/auth/organizations'
        ? { memberships: [] }
        : { selection: null }
    ) as T
  },
}
const visitor = {
  getSession: vi.fn(async () => null),
  signOut: vi.fn(async () => undefined),
}
// Destino que a regra de features/entrar daria e que uma cópia local não reproduziria.
const SENTINEL = '/login?callbackUrl=%2Fvindo-da-regra-unica'

const replace = vi.fn()
beforeEach(() => {
  rule.signInHref.mockClear()
  replace.mockClear()
  const real = window.location
  vi.stubGlobal('location', {
    get pathname() {
      return real.pathname
    },
    get search() {
      return real.search
    },
    replace,
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('RuntimeBootstrap: login da área privada pela regra de features/entrar', () => {
  it("'Entrar' (vitrine) navega para o destino que a regra devolve, com o caminho visível e a query da URL", async () => {
    rule.signInHref.mockReturnValue(SENTINEL)
    window.history.replaceState(null, '', '/area-cliente/pedidos?aba=abertos')
    const navigate = vi.fn()
    render(
      <AppProviders
        apiClient={apiClient}
        auth={visitor}
        navigate={navigate}
        publicTenantSlug="locadora-a"
        internalRoutePrefix="/locadora-a"
        privateArea
        initialSession={null}
        refreshKey="/locadora-a/area-cliente/pedidos"
      >
        <PrivateAreaGate>
          <h1>Área</h1>
        </PrivateAreaGate>
      </AppProviders>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar' }))
    expect(navigate).toHaveBeenCalledWith(SENTINEL)
    expect(rule.signInHref).toHaveBeenCalledWith(
      '/area-cliente/pedidos',
      '?aba=abertos'
    )
  })

  it('a troca automática do painel vai para o destino que a regra devolve', async () => {
    rule.signInHref.mockReturnValue(SENTINEL)
    window.history.replaceState(null, '', '/admin/dashboard')
    render(
      <AppProviders
        apiClient={apiClient}
        auth={visitor}
        navigate={vi.fn()}
        privateArea
        initialSession={null}
        refreshKey="/admin/dashboard"
      >
        <PrivateAreaGate>
          <h1>Painel</h1>
        </PrivateAreaGate>
      </AppProviders>
    )
    await waitFor(() => expect(replace).toHaveBeenCalledWith(SENTINEL))
    await act(async () => {})
    expect(rule.signInHref).toHaveBeenCalledWith('/admin/dashboard', '')
  })
})
