// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AppProviders,
  PrivateAreaGate,
  type HttpClient,
  type TenantContext,
} from '../index.web'
import type { MembershipRole } from '../../entities/organizacao'
import type { SessionAdapter, SessionSnapshot } from '../../entities/sessao'

/**
 * Portão do painel no web (onda 135, A6; M1 do plano de aposentadoria da raiz): o papel do vínculo com a locadora
 * selecionada decide as rotas do painel, como o layout da raiz legada decidia. FINANCIAL só abre o financeiro; as
 * configurações só abrem para ADMIN. O conteúdo da rota nunca monta antes da troca (nada de leitura que a API recusaria
 * por um instante), e a troca substitui a entrada do histórico, como o redirecionamento ao login.
 */
const ana: SessionSnapshot = {
  user: { id: 'user-1', name: 'Ana', email: 'ana@example.test' },
  expires: '2099-01-01T00:00:00.000Z',
}

const membership = (role: MembershipRole): TenantContext => ({
  tenant: {
    id: 't-a',
    slug: 'locadora-a',
    name: 'Locadora A',
    status: 'ACTIVE',
  },
  membershipId: 'm-a',
  role,
})
const selectedAs = (role: MembershipRole): HttpClient => ({
  async request<T>(path: string) {
    return (
      path === '/api/auth/organizations'
        ? { memberships: [membership(role)] }
        : { selection: membership(role) }
    ) as T
  },
})
const auth = (): SessionAdapter => ({
  getSession: vi.fn(async () => ana),
  signOut: vi.fn(async () => undefined),
})

/** `location.replace` observável (o do jsdom não navega). */
const browser = { replace: vi.fn((_url: string) => undefined) }
beforeEach(() => {
  window.localStorage.clear()
  browser.replace.mockClear()
  const real = window.location
  vi.stubGlobal('location', {
    get href() {
      return real.href
    },
    get origin() {
      return real.origin
    },
    get pathname() {
      return real.pathname
    },
    get search() {
      return real.search
    },
    get hash() {
      return real.hash
    },
    replace: browser.replace,
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

/** Rota do painel no web: o portão segue a rota (privateArea do host, sem `privateArea` no portão). */
function panel(role: MembershipRole, route: string, navigate = vi.fn()) {
  window.history.replaceState(null, '', route)
  render(
    <AppProviders
      apiClient={selectedAs(role)}
      auth={auth()}
      navigate={navigate}
      initialSession={ana}
      privateArea
      refreshKey={route}
    >
      <PrivateAreaGate>
        <h1>Conteúdo da rota</h1>
      </PrivateAreaGate>
    </AppProviders>
  )
  return navigate
}
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

describe('portão do painel: papel do vínculo', () => {
  it('FINANCIAL fora do financeiro vai ao financeiro, uma vez, sem montar a rota', async () => {
    const navigate = panel('FINANCIAL', '/admin/dashboard')
    await waitFor(() =>
      expect(browser.replace).toHaveBeenCalledWith('/admin/financeiro')
    )
    expect(screen.getByText('Redirecionando...')).toBeTruthy()
    expect(screen.queryByText('Conteúdo da rota')).toBeNull()
    // Durante a troca, nem o seletor de locadora fica na tela (só o aviso).
    expect(screen.queryByRole('combobox')).toBeNull()
    await settle()
    expect(browser.replace).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('FINANCIAL no financeiro abre a rota', async () => {
    panel('FINANCIAL', '/admin/financeiro')
    expect(await screen.findByText('Conteúdo da rota')).toBeTruthy()
    // Com a rota aberta, o seletor de locadora continua acima dela.
    expect(screen.getByRole('combobox')).toBeTruthy()
    await settle()
    expect(browser.replace).not.toHaveBeenCalled()
  })

  it('FINANCIAL nas configurações também vai ao financeiro', async () => {
    panel('FINANCIAL', '/admin/settings')
    await waitFor(() =>
      expect(browser.replace).toHaveBeenCalledWith('/admin/financeiro')
    )
    expect(screen.queryByText('Conteúdo da rota')).toBeNull()
  })

  it('OPERATOR nas configurações volta ao índice do painel', async () => {
    panel('OPERATOR', '/admin/settings')
    await waitFor(() => expect(browser.replace).toHaveBeenCalledWith('/admin'))
    expect(screen.queryByText('Conteúdo da rota')).toBeNull()
  })

  it.each([
    ['ADMIN', '/admin/settings'],
    ['ADMIN', '/admin/dashboard'],
    ['OPERATOR', '/admin/dashboard'],
  ] as const)('%s em %s abre a rota', async (role, route) => {
    panel(role, route)
    expect(await screen.findByText('Conteúdo da rota')).toBeTruthy()
    await settle()
    expect(browser.replace).not.toHaveBeenCalled()
  })

  it('fora do navegador (sem location.replace) a troca usa a navegação do host', async () => {
    const real = window.location
    vi.stubGlobal('location', {
      get pathname() {
        return real.pathname
      },
      get search() {
        return real.search
      },
    })
    const navigate = panel('FINANCIAL', '/admin/orcamentos')
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/admin/financeiro')
    )
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('a tela do app (portão com privateArea informado) não troca a rota pelo papel', async () => {
    window.history.replaceState(null, '', '/admin/dashboard')
    render(
      <AppProviders
        apiClient={selectedAs('FINANCIAL')}
        auth={auth()}
        navigate={vi.fn()}
        initialSession={ana}
        privateArea
        refreshKey="/admin/dashboard"
      >
        <PrivateAreaGate privateArea>
          <h1>Conteúdo da rota</h1>
        </PrivateAreaGate>
      </AppProviders>
    )
    expect(await screen.findByText('Conteúdo da rota')).toBeTruthy()
    await settle()
    expect(browser.replace).not.toHaveBeenCalled()
  })
})
