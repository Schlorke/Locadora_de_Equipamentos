// @vitest-environment jsdom
// /admin no host `app` (achado 25): destino de app.<raiz>/ (307) e do login da equipe. Decide pela sessão do host,
// como o host anterior; antes ficava em "Redirecionando..." para sempre.
//
// A query de /admin segue junto (achado 32): o host de locadora manda /admin para app.<raiz>/admin?locadora={slug}
// (D8), e a sugestão não pode se perder no redirecionamento do índice nem no login.
//
// Com o portão do painel (achado 115): /admin é área privada no host `app`, então o índice só monta com sessão; sem
// sessão, o portão leva direto ao login com o caminho visível no callbackUrl, sem o pedido "Entre na sua conta".
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AppProviders,
  PrivateAreaGate,
  usePublicTenantRouting,
  type HttpClient,
  type PublicTenantStorage,
  type TenantContext,
} from '@gb-locacoes/frontend/app'
import { resolvePanelCallback } from '@gb-locacoes/frontend/pages/login'

const nav = vi.hoisted(() => {
  const state = { onReplace: null as ((href: string) => void) | null }
  return { state, replace: vi.fn((href: string) => state.onReplace?.(href)) }
})
const auth = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('../../../host/auth/client', () => ({ hostAuth: auth }))

import Page from './page'

const ana = { user: { id: 'u1', name: 'Ana', email: 'equipe@example.test', role: 'ADMIN' }, expires: '2099-01-01T00:00:00.000Z' }

/** `location.replace` observável (o do jsdom não navega); caminho e query continuam os da URL real. */
const browser = { replace: vi.fn((_url: string) => undefined) }

beforeEach(() => {
  vi.clearAllMocks()
  nav.state.onReplace = null
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
    replace: browser.replace,
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('/admin no host app', () => {
  it('com sessão: segue para o dashboard', async () => {
    auth.getSession.mockResolvedValue({ user: { id: 'u1', email: 'equipe@example.test', role: 'ADMIN' } })
    render(<Page />)
    expect(screen.getByText('Redirecionando...')).toBeTruthy()
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin/dashboard'))
    expect(nav.replace).toHaveBeenCalledTimes(1)
  })

  it('sem sessão ou com a sessão indisponível: segue para a entrada da equipe', async () => {
    auth.getSession.mockResolvedValueOnce(null)
    render(<Page />)
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin/login'))
    cleanup()
    nav.replace.mockClear()
    auth.getSession.mockRejectedValueOnce(new Error('indisponível'))
    render(<Page />)
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin/login'))
  })

  it('a query de /admin segue para o dashboard e, sem sessão, volta a /admin pelo login da equipe', async () => {
    window.history.replaceState(null, '', '/admin?locadora=locadora-b')
    auth.getSession.mockResolvedValueOnce(ana)
    render(<Page />)
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin/dashboard?locadora=locadora-b'))
    cleanup()
    nav.replace.mockClear()
    auth.getSession.mockResolvedValueOnce(null)
    render(<Page />)
    const back = '/admin?locadora=locadora-b'
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin/login?callbackUrl=' + encodeURIComponent(back)))
    // O login da equipe aceita esse retorno sem mudar: depois de entrar, /admin recebe a sugestão de novo.
    expect(resolvePanelCallback(back)).toBe(back)
  })
})

const membership = (slug: string, name: string): TenantContext => ({
  tenant: { id: 't-' + slug, slug, name, status: 'ACTIVE' },
  membershipId: 'm-' + slug,
  role: 'ADMIN',
})
const locadoraA = membership('locadora-a', 'Locadora A')
const locadoraB = membership('locadora-b', 'Locadora B')

function panelApi() {
  let selection: TenantContext | null = locadoraA
  const posts: string[] = []
  const client: HttpClient = {
    async request<T>(path: string, options: { method?: string; body?: string } = {}) {
      if (path === '/api/auth/organizations') return { memberships: [locadoraA, locadoraB] } as T
      if (path === '/api/auth/organizations/selection' && options.method === 'POST') {
        const { tenantId } = JSON.parse(options.body ?? '{}') as { tenantId: string }
        posts.push(tenantId)
        selection = [locadoraA, locadoraB].find((item) => item.tenant.id === tenantId) ?? null
        return { selection } as T
      }
      return { selection } as T
    },
  }
  return { client, posts }
}

// Como o AppHostProviders: o host `app` não tem locadora pública; nada é lembrado nem aplicado na URL.
const noPublicTenantStorage: PublicTenantStorage = { getItem: () => null, setItem: () => undefined }
const keepUrl = () => undefined

/**
 * Como o AppHostProviders: a rota atual é a `refreshKey`, a área privada e o resto vêm da regra real de roteamento do
 * host (`usePublicTenantRouting`), o portão fica dentro da área e /admin monta o índice real.
 */
function PanelHost({ client, navigate }: { client: HttpClient; navigate: (href: string) => void }) {
  const [pathname, setPathname] = useState(window.location.pathname)
  useEffect(() => {
    nav.state.onReplace = (href) => {
      window.history.replaceState(null, '', href)
      setPathname(new URL(href, window.location.origin).pathname)
    }
  }, [])
  const routing = usePublicTenantRouting({ pathname, explicitSlug: null, storage: noPublicTenantStorage, applySlug: keepUrl })
  const adapter = { getSession: auth.getSession, signOut: vi.fn(async () => undefined) }
  return (
    <AppProviders apiClient={client} auth={adapter} navigate={navigate} refreshKey={pathname} {...routing}>
      <PrivateAreaGate>{pathname === '/admin' ? <Page /> : <h1>Painel {pathname}</h1>}</PrivateAreaGate>
    </AppProviders>
  )
}

describe('/admin?locadora= com outra locadora já selecionada (achado 32)', () => {
  const question = 'Você veio do endereço de Locadora B. Trocar a locadora do painel de Locadora A para Locadora B?'

  beforeAll(() => {
    // O seletor do painel é o Select do Radix: no jsdom faltam estas APIs de ponteiro e rolagem.
    Element.prototype.scrollIntoView ??= () => undefined
    Element.prototype.hasPointerCapture ??= () => false
    Element.prototype.releasePointerCapture ??= () => undefined
  })

  it('o índice redireciona ao dashboard com a sugestão; a pergunta continua até ser confirmada', async () => {
    window.history.replaceState(null, '', '/admin?locadora=locadora-b')
    auth.getSession.mockResolvedValue(ana)
    const api = panelApi()
    render(<PanelHost client={api.client} navigate={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'Painel /admin/dashboard' })).toBeTruthy()
    expect(nav.replace).toHaveBeenCalledWith('/admin/dashboard?locadora=locadora-b')
    expect(window.location.pathname + window.location.search).toBe('/admin/dashboard?locadora=locadora-b')
    expect(await screen.findByText(question)).toBeTruthy()
    expect(api.posts).toEqual([])
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Trocar para Locadora B' }))
    })
    await waitFor(() => expect(api.posts).toEqual(['t-locadora-b']))
    await waitFor(() => expect(screen.queryByText(question)).toBeNull())
  })

  /** Navegação no cliente do painel (a mesma do `router.replace` do índice): troca a URL e a rota do host. */
  async function goTo(href: string) {
    await act(async () => {
      nav.state.onReplace?.(href)
    })
  }

  /** Escolhe a locadora pelo seletor do painel (não pela pergunta), pelo teclado. */
  async function chooseInSelector(name: string) {
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    })
    await act(async () => {
      fireEvent.keyDown(await screen.findByRole('option', { name }), { key: 'Enter' })
    })
  }

  it('escolher B pelo seletor atende a sugestão: navegar e voltar para A não repete a pergunta', async () => {
    window.history.replaceState(null, '', '/admin?locadora=locadora-b')
    auth.getSession.mockResolvedValue(ana)
    const api = panelApi()
    render(<PanelHost client={api.client} navigate={vi.fn()} />)
    expect(await screen.findByText(question)).toBeTruthy()
    await chooseInSelector('Locadora B')
    await waitFor(() => expect(api.posts).toEqual(['t-locadora-b']))
    await waitFor(() => expect(screen.queryByText(question)).toBeNull())
    await goTo('/admin/equipamentos')
    expect(await screen.findByRole('heading', { name: 'Painel /admin/equipamentos' })).toBeTruthy()
    await chooseInSelector('Locadora A')
    await waitFor(() => expect(api.posts).toEqual(['t-locadora-b', 't-locadora-a']))
    await act(async () => {})
    expect(await screen.findByRole('heading', { name: 'Painel /admin/equipamentos' })).toBeTruthy()
    expect(screen.queryByText(/Você veio do endereço/)).toBeNull()
  })

  it('a sugestão não atravessa a sessão: sair e entrar como outra conta, pelo login, não traz a pergunta', async () => {
    const bia = { user: { id: 'u2', name: 'Bia', email: 'bia@example.test', role: 'ADMIN' }, expires: '2099-01-01T00:00:00.000Z' }
    let current: typeof ana | null = ana
    auth.getSession.mockImplementation(async () => current)
    window.history.replaceState(null, '', '/admin?locadora=locadora-b')
    const api = panelApi()
    render(<PanelHost client={api.client} navigate={vi.fn()} />)
    expect(await screen.findByText(question)).toBeTruthy()
    await goTo('/admin/equipamentos')
    expect(await screen.findByRole('heading', { name: 'Painel /admin/equipamentos' })).toBeTruthy()
    expect(screen.getByText(question)).toBeTruthy()
    // A sessão acaba; o login (rota pública do host `app`) volta (replace) para a rota em que a pessoa estava, sem a
    // sugestão.
    current = null
    await goTo('/login?callbackUrl=' + encodeURIComponent('/admin/equipamentos'))
    expect(await screen.findByRole('heading', { name: 'Painel /login' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText(/Você veio do endereço/)).toBeNull())
    current = bia
    await goTo('/admin/equipamentos')
    expect(await screen.findByRole('heading', { name: 'Painel /admin/equipamentos' })).toBeTruthy()
    await act(async () => {})
    expect(screen.queryByText(/Você veio do endereço/)).toBeNull()
    expect(api.posts).toEqual([])
  })
})

describe('/admin sem sessão: o portão do painel leva direto ao login (achado 115)', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin?locadora=locadora-b', '/admin?locadora=locadora-b'],
    ['/admin/dashboard', '/admin/dashboard'],
  ])('%s: troca a rota por /login com o caminho visível no callbackUrl, sem o pedido de login', async (url, back) => {
    window.history.replaceState(null, '', url)
    auth.getSession.mockResolvedValue(null)
    const navigate = vi.fn()
    render(<PanelHost client={panelApi().client} navigate={navigate} />)
    await waitFor(() => expect(browser.replace).toHaveBeenCalledWith('/login?callbackUrl=' + encodeURIComponent(back)))
    expect(screen.getByText('Redirecionando...')).toBeTruthy()
    expect(screen.queryByText('Entre na sua conta para selecionar uma locadora.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(browser.replace).toHaveBeenCalledTimes(1)
    // Nenhuma outra navegação: nem o "Entrar" do portão nem o índice (que só monta com sessão).
    expect(navigate).not.toHaveBeenCalled()
    expect(nav.replace).not.toHaveBeenCalled()
    // O login aceita o retorno sem mudar: depois de entrar, a pessoa volta para onde estava.
    expect(resolvePanelCallback(back)).toBe(back)
  })

  // Segunda rodada: o erro limpo pelo "Tentar novamente" deixava o status 'unauthenticated' do erro até a nova leitura
  // responder, e o portão ia ao login antes da resposta.
  it('sessão indisponível: "Tentar novamente" relê no lugar e, com a sessão de volta, o índice real segue ao dashboard sem passar pelo login', async () => {
    window.history.replaceState(null, '', '/admin?locadora=locadora-b')
    let release!: () => void
    auth.getSession
      .mockRejectedValueOnce(new Error('Sessão indisponível.'))
      .mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(ana) }))
      .mockResolvedValue(ana)
    render(<PanelHost client={panelApi().client} navigate={vi.fn()} />)
    expect(await screen.findByText('Sessão indisponível.')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(browser.replace).not.toHaveBeenCalled()
    expect(screen.getByText('Carregando...')).toBeTruthy()
    await act(async () => {
      release()
    })
    expect(await screen.findByRole('heading', { name: 'Painel /admin/dashboard' })).toBeTruthy()
    expect(nav.replace).toHaveBeenCalledWith('/admin/dashboard?locadora=locadora-b')
    expect(browser.replace).not.toHaveBeenCalled()
  })

  it('depois de entrar, o login devolve a pessoa a /admin e o índice real segue ao dashboard', async () => {
    window.history.replaceState(null, '', '/admin')
    auth.getSession.mockResolvedValue(null)
    render(<PanelHost client={panelApi().client} navigate={vi.fn()} />)
    await waitFor(() => expect(browser.replace).toHaveBeenCalledWith('/login?callbackUrl=%2Fadmin'))
    cleanup()
    // O login aplica o callbackUrl: o navegador volta a /admin, agora com sessão.
    auth.getSession.mockResolvedValue(ana)
    window.history.replaceState(null, '', '/admin')
    render(<PanelHost client={panelApi().client} navigate={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'Painel /admin/dashboard' })).toBeTruthy()
    expect(nav.replace).toHaveBeenCalledWith('/admin/dashboard')
    expect(browser.replace).toHaveBeenCalledTimes(1)
  })
})
