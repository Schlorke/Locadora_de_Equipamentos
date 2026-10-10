// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AppProviders,
  PrivateAreaGate,
  type HttpClient,
  type TenantContext,
} from '../index.web'
import {
  useSession,
  type SessionAdapter,
  type SessionSnapshot,
} from '../../entities/sessao'
import { useCartStore, type CartItem } from '../../features/carrinho'
import { keyValueStorage } from '../../shared/storage'

const ana = {
  user: { id: 'user-1', name: 'Ana', email: 'ana@example.test' },
  expires: '2099-01-01T00:00:00.000Z',
}
const locadoraA: TenantContext = {
  tenant: {
    id: 't-a',
    slug: 'locadora-a',
    name: 'Locadora A',
    status: 'ACTIVE',
  },
  membershipId: 'm-a',
  role: 'ADMIN',
}

const apiClient: HttpClient = {
  async request<T>(path: string) {
    return (
      path === '/api/auth/organizations'
        ? { memberships: [] }
        : { selection: null }
    ) as T
  },
}

function adapter(getSession: SessionAdapter['getSession']) {
  return {
    getSession: vi.fn(getSession),
    signOut: vi.fn(async () => undefined),
  }
}

function Probe() {
  const session = useSession()
  return (
    <div>
      <h1>Conteúdo da rota</h1>
      <span data-testid="status">{session.status}</span>
      <span data-testid="user">{session.data?.user.name ?? 'visitante'}</span>
    </div>
  )
}

/** Stand-in do navegador do host (Stack do Expo Router / árvore de rotas do Next): conta montagens. */
const navigatorLife = { mounts: 0, unmounts: 0 }
function Navigator({ children }: { children: ReactNode }) {
  useEffect(() => {
    navigatorLife.mounts += 1
    return () => {
      navigatorLife.unmounts += 1
    }
  }, [])
  return <>{children}</>
}

type BootstrapProps = {
  initialSession?: SessionSnapshot
  refreshKey?: string
  privateArea?: boolean
  awaitSession?: boolean
  publicTenantSlug?: string | null
  apiClient?: HttpClient
  navigate?: (href: string) => void
  resolveHref?: (href: string) => string
}

// Como os hosts: o bootstrap envolve o navegador; o portão fica dentro da área (tela/rota).
function renderBootstrap(
  auth: SessionAdapter,
  props: BootstrapProps = {},
  content: ReactNode = <Probe />
) {
  const view = (next: BootstrapProps) => (
    <AppProviders
      apiClient={apiClient}
      auth={auth}
      navigate={() => {}}
      refreshKey={next.refreshKey ?? '/'}
      {...next}
    >
      <Navigator>
        <PrivateAreaGate>{content}</PrivateAreaGate>
      </Navigator>
    </AppProviders>
  )
  const result = render(view(props))
  return {
    ...result,
    rerenderWith: (next: BootstrapProps) => result.rerender(view(next)),
  }
}

/**
 * `location` do navegador com `replace` observável (o do jsdom não navega): caminho e query continuam os da URL real,
 * que os casos trocam com `history.replaceState`.
 */
const browser = { replace: vi.fn((_url: string) => undefined) }
function stubBrowserLocation() {
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
}

beforeEach(() => {
  window.localStorage.clear()
  navigatorLife.mounts = 0
  navigatorLife.unmounts = 0
  browser.replace.mockClear()
  stubBrowserLocation()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('RuntimeBootstrap', () => {
  it("rota pública renderiza os filhos já com status 'loading', sem trocar a árvore por 'Carregando...'", async () => {
    let resolve!: (value: SessionSnapshot) => void
    const auth = adapter(
      () =>
        new Promise((r) => {
          resolve = r
        })
    )
    renderBootstrap(auth, { publicTenantSlug: 'locadora-a' })

    expect(screen.getByText('Conteúdo da rota')).toBeTruthy()
    expect(screen.getByTestId('status').textContent).toBe('loading')
    expect(screen.queryByText('Carregando...')).toBeNull()

    await act(async () => {
      resolve(ana)
    })
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('authenticated')
    )
    expect(screen.getByTestId('user').textContent).toBe('Ana')
    expect(auth.getSession).toHaveBeenCalledTimes(1)
  })

  it('aproveita a sessão entregue pelo host sem getSession inicial e revalida só nas navegações seguintes', async () => {
    const auth = adapter(async () => ana)
    const view = renderBootstrap(auth, {
      initialSession: ana,
      refreshKey: '/equipamentos',
    })

    expect(screen.getByTestId('status').textContent).toBe('authenticated')
    expect(screen.getByTestId('user').textContent).toBe('Ana')
    await act(async () => {
      await Promise.resolve()
    })
    expect(auth.getSession).not.toHaveBeenCalled()

    view.rerenderWith({ initialSession: ana, refreshKey: '/sobre' })
    await waitFor(() => expect(auth.getSession).toHaveBeenCalledTimes(1))
  })

  it('sessão nula do host é visitante confirmado, sem getSession', async () => {
    const auth = adapter(async () => ana)
    renderBootstrap(auth, { initialSession: null })
    expect(screen.getByTestId('status').textContent).toBe('unauthenticated')
    expect(screen.getByTestId('user').textContent).toBe('visitante')
    await act(async () => {
      await Promise.resolve()
    })
    expect(auth.getSession).not.toHaveBeenCalled()
  })

  it('com a sessão do host, o carrinho abre no escopo da locadora e do usuário', async () => {
    renderBootstrap(
      adapter(async () => ana),
      { initialSession: ana, publicTenantSlug: 'locadora-a' }
    )
    await waitFor(() =>
      expect(useCartStore.persist.getOptions().name).toBe(
        'cart:' + encodeURIComponent(JSON.stringify(['locadora-a', 'user-1']))
      )
    )
  })

  it('rotas que pedem awaitSession esperam a sessão e o escopo do carrinho antes de montar a rota', async () => {
    const scopeKey =
      'cart:' + encodeURIComponent(JSON.stringify(['locadora-a', 'anonymous']))
    const item: CartItem = {
      equipmentId: 'eq-1',
      equipmentName: 'Betoneira',
      pricePerDay: 100,
      quantity: 1,
      days: 1,
      selectedPeriod: {
        id: 'daily',
        label: 'Diário',
        period: 'dia',
        multiplier: 1,
        discount: 0,
      },
      finalPrice: 100,
    } as CartItem
    // A leitura do carrinho da locadora fica pendente depois que a sessão resolve.
    let releaseScope!: () => void
    const scopeRead = new Promise<null>((resolve) => {
      releaseScope = () => resolve(null)
    })
    const readStorage = keyValueStorage.getItem.bind(keyValueStorage)
    const getItem = vi
      .spyOn(keyValueStorage, 'getItem')
      .mockImplementation((key: string) =>
        key === scopeKey ? (scopeRead as unknown as string) : readStorage(key)
      )
    // Como /orcamento?equipmentId=...: adiciona ao carrinho ao montar.
    function AddsOnMount() {
      useEffect(() => {
        useCartStore.getState().addItem(item)
      }, [])
      return <Probe />
    }
    let resolve!: (value: SessionSnapshot) => void
    renderBootstrap(
      adapter(
        () =>
          new Promise((r) => {
            resolve = r
          })
      ),
      { awaitSession: true, publicTenantSlug: 'locadora-a' },
      <AddsOnMount />
    )
    expect(screen.getByText('Carregando...')).toBeTruthy()
    expect(screen.queryByText('Conteúdo da rota')).toBeNull()

    await act(async () => {
      resolve(null)
    })
    await waitFor(() => expect(getItem).toHaveBeenCalledWith(scopeKey))
    // Sessão resolvida, escopo do carrinho ainda não: a rota continua sem montar.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(screen.getByText('Carregando...')).toBeTruthy()
    expect(screen.queryByText('Conteúdo da rota')).toBeNull()

    await act(async () => {
      releaseScope()
    })
    expect(await screen.findByText('Conteúdo da rota')).toBeTruthy()
    expect(screen.getByTestId('status').textContent).toBe('unauthenticated')
    // O item adicionado ao montar fica no carrinho da locadora e persiste no escopo certo.
    await waitFor(() =>
      expect(
        useCartStore.getState().items.map((entry) => entry.equipmentId)
      ).toEqual(['eq-1'])
    )
    expect(useCartStore.persist.getOptions().name).toBe(scopeKey)
    await waitFor(() =>
      expect(
        JSON.parse(
          window.localStorage.getItem(scopeKey) ?? '{}'
        ).state?.items?.map((entry: CartItem) => entry.equipmentId)
      ).toEqual(['eq-1'])
    )
  })

  // Achado 115: no painel (modo seleção, portão que segue a rota do web) a rota privada sem sessão ia para o pedido
  // "Entre na sua conta para selecionar uma locadora." e o índice /admin nunca montava; agora vai direto ao login.
  it('painel no web: área privada aguarda a sessão e, sem sessão, vai direto ao login com retorno para a rota, sem o pedido de login', async () => {
    let resolve!: (value: SessionSnapshot) => void
    const navigate = vi.fn()
    window.history.replaceState(
      null,
      '',
      '/admin/orcamentos?status=PENDENTE&locadora=locadora-a'
    )
    renderBootstrap(
      adapter(
        () =>
          new Promise((r) => {
            resolve = r
          })
      ),
      { privateArea: true, navigate, refreshKey: '/admin/orcamentos' }
    )
    expect(screen.getByText('Carregando...')).toBeTruthy()
    expect(screen.queryByText('Conteúdo da rota')).toBeNull()
    expect(browser.replace).not.toHaveBeenCalled()
    await act(async () => {
      resolve(null)
    })
    // Troca a entrada do histórico (o "voltar" não cai de novo na rota que redireciona), com a query da URL.
    await waitFor(() =>
      expect(browser.replace).toHaveBeenCalledWith(
        '/login?callbackUrl=' +
          encodeURIComponent(
            '/admin/orcamentos?status=PENDENTE&locadora=locadora-a'
          )
      )
    )
    expect(screen.getByText('Redirecionando...')).toBeTruthy()
    expect(
      screen.queryByText('Entre na sua conta para selecionar uma locadora.')
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull()
    expect(screen.queryByText('Conteúdo da rota')).toBeNull()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(browser.replace).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('painel no web: a troca para o login passa pelo resolvedor de href do host', async () => {
    window.history.replaceState(null, '', '/admin/dashboard')
    renderBootstrap(
      adapter(async () => null),
      {
        initialSession: null,
        privateArea: true,
        refreshKey: '/admin/dashboard',
        resolveHref: (href) => href + '&tenantSlug=locadora-a',
      }
    )
    await waitFor(() =>
      expect(browser.replace).toHaveBeenCalledWith(
        '/login?callbackUrl=%2Fadmin%2Fdashboard&tenantSlug=locadora-a'
      )
    )
  })

  it('painel fora do navegador (sem location.replace): a troca usa a navegação do host', async () => {
    const real = window.location
    vi.stubGlobal('location', {
      get pathname() {
        return real.pathname
      },
      get search() {
        return real.search
      },
    })
    window.history.replaceState(null, '', '/admin/dashboard?aba=hoje')
    const navigate = vi.fn()
    renderBootstrap(
      adapter(async () => null),
      {
        initialSession: null,
        privateArea: true,
        navigate,
        refreshKey: '/admin/dashboard',
      }
    )
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        '/login?callbackUrl=' + encodeURIComponent('/admin/dashboard?aba=hoje')
      )
    )
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it("painel no web: erro ao ler a sessão não é visitante confirmado; fica o pedido com 'Tentar novamente', sem redirecionar", async () => {
    const navigate = vi.fn()
    window.history.replaceState(null, '', '/admin/dashboard')
    renderBootstrap(
      adapter(async () => {
        throw new Error('Sessão indisponível.')
      }),
      { privateArea: true, navigate, refreshKey: '/admin/dashboard' }
    )
    expect(await screen.findByText('Sessão indisponível.')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(navigate).toHaveBeenCalledWith(
      '/login?callbackUrl=%2Fadmin%2Fdashboard'
    )
    expect(browser.replace).not.toHaveBeenCalled()
  })

  // Segunda rodada do achado 115: o `refresh()` limpa o erro na hora, mas o status 'unauthenticated' do erro fica até a
  // nova leitura responder; o portão tomava esse status velho por visitante confirmado e trocava a rota pelo login antes
  // da resposta. Só uma leitura já respondida (ou a sessão entregue pelo host) confirma o visitante.
  describe('painel no web: só a leitura já respondida confirma o visitante', () => {
    /** 1ª leitura falha com "Sessão indisponível."; as seguintes esperam `answer` (o teste decide quando e o quê). */
    function failingThenHeld() {
      const pending: Array<{
        resolve: (value: SessionSnapshot) => void
        reject: (error: Error) => void
      }> = []
      let calls = 0
      const auth = adapter(() => {
        calls += 1
        if (calls === 1)
          return Promise.reject(new Error('Sessão indisponível.'))
        return new Promise<SessionSnapshot>((resolve, reject) => {
          pending.push({ resolve, reject })
        })
      })
      const answer = async (outcome: SessionSnapshot | Error) => {
        await waitFor(() => expect(pending.length).toBeGreaterThan(0))
        await act(async () => {
          const next = pending.shift()!
          if (outcome instanceof Error) next.reject(outcome)
          else next.resolve(outcome)
        })
      }
      return { auth, answer }
    }
    const selected: HttpClient = {
      async request<T>(path: string) {
        return (
          path === '/api/auth/organizations'
            ? { memberships: [locadoraA] }
            : { selection: locadoraA }
        ) as T
      },
    }
    const settle = () =>
      act(async () => {
        await new Promise((r) => setTimeout(r, 20))
      })

    it("'Tentar novamente' relê a sessão no lugar: enquanto a leitura não responde, espera sem trocar a rota; sessão válida abre o painel", async () => {
      const navigate = vi.fn()
      const { auth, answer } = failingThenHeld()
      window.history.replaceState(null, '', '/admin/dashboard')
      renderBootstrap(auth, {
        privateArea: true,
        navigate,
        refreshKey: '/admin/dashboard',
        apiClient: selected,
      })
      expect(await screen.findByText('Sessão indisponível.')).toBeTruthy()
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Tentar novamente' })
        )
      })
      await settle()
      expect(browser.replace).not.toHaveBeenCalled()
      expect(screen.getByText('Carregando...')).toBeTruthy()
      expect(
        screen.queryByText('Entre na sua conta para selecionar uma locadora.')
      ).toBeNull()
      expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull()
      await answer(ana)
      expect(await screen.findByText('Conteúdo da rota')).toBeTruthy()
      await settle()
      expect(browser.replace).not.toHaveBeenCalled()
      expect(navigate).not.toHaveBeenCalled()
    })

    it("'Tentar novamente' que confirma o visitante vai ao login só depois da resposta, uma vez", async () => {
      const { auth, answer } = failingThenHeld()
      window.history.replaceState(null, '', '/admin/dashboard?aba=hoje')
      renderBootstrap(auth, {
        privateArea: true,
        refreshKey: '/admin/dashboard',
        apiClient: selected,
      })
      expect(await screen.findByText('Sessão indisponível.')).toBeTruthy()
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Tentar novamente' })
        )
      })
      await settle()
      expect(browser.replace).not.toHaveBeenCalled()
      await answer(null)
      await waitFor(() =>
        expect(browser.replace).toHaveBeenCalledWith(
          '/login?callbackUrl=' +
            encodeURIComponent('/admin/dashboard?aba=hoje')
        )
      )
      await settle()
      expect(browser.replace).toHaveBeenCalledTimes(1)
    })

    it("'Tentar novamente' com a sessão ainda indisponível volta ao pedido com o erro, sem redirecionar", async () => {
      const { auth, answer } = failingThenHeld()
      window.history.replaceState(null, '', '/admin/dashboard')
      renderBootstrap(auth, {
        privateArea: true,
        refreshKey: '/admin/dashboard',
        apiClient: selected,
      })
      expect(await screen.findByText('Sessão indisponível.')).toBeTruthy()
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Tentar novamente' })
        )
      })
      await answer(new Error('Ainda indisponível.'))
      expect(await screen.findByText('Ainda indisponível.')).toBeTruthy()
      expect(
        screen.getByRole('button', { name: 'Tentar novamente' })
      ).toBeTruthy()
      await settle()
      expect(browser.replace).not.toHaveBeenCalled()
    })

    it('navegar para outra rota do painel com o erro na tela espera a leitura da rota nova; sessão válida abre o painel', async () => {
      const { auth, answer } = failingThenHeld()
      window.history.replaceState(null, '', '/admin/dashboard')
      const view = renderBootstrap(auth, {
        privateArea: true,
        refreshKey: '/admin/dashboard',
        apiClient: selected,
      })
      expect(await screen.findByText('Sessão indisponível.')).toBeTruthy()
      window.history.replaceState(null, '', '/admin/equipamentos')
      view.rerenderWith({
        privateArea: true,
        refreshKey: '/admin/equipamentos',
        apiClient: selected,
      })
      await settle()
      expect(browser.replace).not.toHaveBeenCalled()
      expect(screen.getByText('Carregando...')).toBeTruthy()
      await answer(ana)
      expect(await screen.findByText('Conteúdo da rota')).toBeTruthy()
      await settle()
      expect(browser.replace).not.toHaveBeenCalled()
    })

    it('visitante confirmado numa rota pública da mesma árvore: entrar no painel espera a leitura da rota nova (a sessão pode ter começado em outra aba)', async () => {
      let current: SessionSnapshot = null
      let release!: () => void
      const auth = adapter(async () => {
        const answer = current
        if (answer)
          await new Promise<void>((r) => {
            release = r
          })
        return answer
      })
      window.history.replaceState(null, '', '/equipamentos')
      const view = renderBootstrap(auth, {
        privateArea: false,
        refreshKey: '/equipamentos',
        apiClient: selected,
      })
      await waitFor(() =>
        expect(screen.getByTestId('status').textContent).toBe('unauthenticated')
      )
      current = ana
      window.history.replaceState(null, '', '/admin/dashboard')
      view.rerenderWith({
        privateArea: true,
        refreshKey: '/admin/dashboard',
        apiClient: selected,
      })
      await settle()
      expect(browser.replace).not.toHaveBeenCalled()
      await act(async () => {
        release()
      })
      expect(await screen.findByText('Conteúdo da rota')).toBeTruthy()
      await settle()
      expect(browser.replace).not.toHaveBeenCalled()
    })
  })

  it("'Sair' no painel: o destino é o callbackUrl de quem saiu, sem o login automático", async () => {
    function SignOut() {
      const session = useSession()
      return (
        <button
          onClick={() => {
            void session.signOut({ callbackUrl: '/admin/login' })
          }}
        >
          Sair
        </button>
      )
    }
    const selected: HttpClient = {
      async request<T>(path: string) {
        return (
          path === '/api/auth/organizations'
            ? { memberships: [locadoraA] }
            : { selection: locadoraA }
        ) as T
      },
    }
    const navigate = vi.fn()
    window.history.replaceState(null, '', '/admin/dashboard')
    renderBootstrap(
      adapter(async () => ana),
      {
        initialSession: ana,
        privateArea: true,
        navigate,
        refreshKey: '/admin/dashboard',
        apiClient: selected,
      },
      <>
        <Probe />
        <SignOut />
      </>
    )
    expect(await screen.findByText('Conteúdo da rota')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    })
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/login'))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(browser.replace).not.toHaveBeenCalled()
  })

  describe('login da área privada: callbackUrl', () => {
    /**
     * Visitante confirmado na rota privada `refreshKey`, com o navegador em `url`; devolve o href do login pelos dois
     * caminhos do portão: o "Entrar" de uma tela do app (`privateArea` informado) e a troca automática do painel no web.
     */
    const ways: Record<
      string,
      (refreshKey: string, url: string) => Promise<string>
    > = {
      "'Entrar' da tela do app": async (refreshKey, url) => {
        const navigate = vi.fn()
        window.history.replaceState(null, '', url)
        render(
          <AppProviders
            apiClient={apiClient}
            auth={adapter(async () => null)}
            navigate={navigate}
            initialSession={null}
            privateArea
            refreshKey={refreshKey}
          >
            <PrivateAreaGate privateArea>
              <Probe />
            </PrivateAreaGate>
          </AppProviders>
        )
        fireEvent.click(await screen.findByRole('button', { name: 'Entrar' }))
        expect(navigate).toHaveBeenCalledTimes(1)
        // A tela do app mantém o pedido de login: nada troca a rota sozinho.
        expect(browser.replace).not.toHaveBeenCalled()
        return navigate.mock.calls[0]![0] as string
      },
      'troca automática do painel no web': async (refreshKey, url) => {
        const navigate = vi.fn()
        window.history.replaceState(null, '', url)
        renderBootstrap(
          adapter(async () => null),
          { initialSession: null, privateArea: true, navigate, refreshKey }
        )
        await waitFor(() => expect(browser.replace).toHaveBeenCalledTimes(1))
        expect(navigate).not.toHaveBeenCalled()
        return browser.replace.mock.calls[0]![0]
      },
    }
    const callbackOf = (href: string) =>
      new URL(href, 'http://callback.invalid').searchParams.get('callbackUrl')

    describe.each(Object.entries(ways))('%s', (_way, signInFrom) => {
      it('a URL do navegador de outra rota não empresta a query: vai só o caminho da rota atual', async () => {
        const href = await signInFrom(
          '/area-cliente/pedidos',
          '/equipamentos?categoria=andaimes'
        )
        expect(href).toBe('/login?callbackUrl=%2Farea-cliente%2Fpedidos')
        expect(callbackOf(href)).toBe('/area-cliente/pedidos')
      })

      it('query que o login decodificaria de novo (e mudaria) fica de fora; o caminho continua', async () => {
        const href = await signInFrom(
          '/area-cliente/pedidos',
          '/area-cliente/pedidos?busca=a%26b'
        )
        expect(callbackOf(href)).toBe('/area-cliente/pedidos')
      })

      it.each(['//evil.example/area-cliente', '/area-cliente/%2e%2e/admin'])(
        'caminho que o login recusaria (%s) não vira callbackUrl',
        async (route) => {
          expect(await signInFrom(route, '/')).toBe('/login')
        }
      )
    })
  })

  it('o navegador do host nunca é desmontado: entrada na área privada, troca de escopo, seleção e saída', async () => {
    let selection: TenantContext | null = locadoraA
    const scoped: HttpClient = {
      async request<T>(path: string) {
        return (
          path === '/api/auth/organizations'
            ? { memberships: [locadoraA] }
            : { selection }
        ) as T
      },
    }
    let resolve!: (value: SessionSnapshot) => void
    const auth = adapter(
      () =>
        new Promise((r) => {
          resolve = r
        })
    )
    // Começa em rota pública sem slug público (escopo nulo) e entra na área privada: o escopo muda para a locadora selecionada.
    const view = renderBootstrap(auth, {
      apiClient: scoped,
      publicTenantSlug: null,
      refreshKey: '/',
    })
    expect(screen.getByText('Conteúdo da rota')).toBeTruthy()
    view.rerenderWith({
      apiClient: scoped,
      publicTenantSlug: null,
      privateArea: true,
      refreshKey: '/admin/dashboard',
    })
    expect(screen.getByText('Carregando...')).toBeTruthy()
    await act(async () => {
      resolve(ana)
    })
    expect(await screen.findByText('Conteúdo da rota')).toBeTruthy()
    expect(screen.getByText('Locadora')).toBeTruthy()
    await waitFor(() =>
      expect(useCartStore.persist.getOptions().name).toBe(
        'cart:' + encodeURIComponent(JSON.stringify(['locadora-a', 'user-1']))
      )
    )

    // Sai para a vitrine e volta: o conteúdo da área reabre sem remontar o navegador.
    view.rerenderWith({
      apiClient: scoped,
      publicTenantSlug: 'locadora-b',
      privateArea: false,
      refreshKey: '/equipamentos',
    })
    expect(await screen.findByText('Conteúdo da rota')).toBeTruthy()
    view.rerenderWith({
      apiClient: scoped,
      publicTenantSlug: 'locadora-b',
      privateArea: true,
      refreshKey: '/admin/dashboard',
    })
    expect(await screen.findByText('Conteúdo da rota')).toBeTruthy()

    // Sem seleção (ex.: sessão de outro usuário): seletor dentro da área, conteúdo oculto.
    selection = null
    auth.getSession.mockResolvedValue({
      user: { id: 'user-2', name: 'Bia' },
      expires: ana.expires,
    })
    view.rerenderWith({
      apiClient: scoped,
      publicTenantSlug: 'locadora-b',
      privateArea: true,
      refreshKey: '/admin/orcamentos',
    })
    await waitFor(() =>
      expect(screen.queryByText('Conteúdo da rota')).toBeNull()
    )
    expect(await screen.findByText('Locadora')).toBeTruthy()

    expect(navigatorLife).toEqual({ mounts: 1, unmounts: 0 })
  })

  describe('web: troca de rota com troca de escopo do carrinho, vindo de uma área já aberta', () => {
    const locadoraB: TenantContext = {
      tenant: {
        id: 't-b',
        slug: 'locadora-b',
        name: 'Locadora B',
        status: 'ACTIVE',
      },
      membershipId: 'm-b',
      role: 'CLIENT',
    }
    const keyOf = (slug: string) =>
      'cart:' + encodeURIComponent(JSON.stringify([slug, 'user-1']))
    const stored = (equipmentId: string): CartItem => ({
      equipmentId,
      equipmentName: equipmentId,
      pricePerDay: 100,
      quantity: 1,
      days: 1,
    })
    /** Itens do carrinho salvo no aparelho para a locadora (usuário "user-1"). */
    const savedIn = (slug: string) =>
      (
        JSON.parse(window.localStorage.getItem(keyOf(slug)) ?? '{}') as {
          state?: { items?: CartItem[] }
        }
      ).state?.items?.map((entry) => entry.equipmentId)
    const withSelectionB: HttpClient = {
      async request<T>(path: string) {
        return (
          path === '/api/auth/organizations'
            ? { memberships: [locadoraB] }
            : { selection: locadoraB }
        ) as T
      },
    }
    type Route = {
      refreshKey: string
      publicTenantSlug: string | null
      privateArea: boolean
      awaitSession: boolean
      content: ReactNode
    }
    // Como o ClientLayoutShell: um único PrivateAreaGate (sem `privateArea`, segue a rota) cujo conteúdo muda com a rota.
    function renderRoute(route: Route) {
      const view = (next: Route) => (
        <AppProviders
          apiClient={withSelectionB}
          auth={adapter(async () => ana)}
          initialSession={ana}
          navigate={() => {}}
          publicTenantSlug={next.publicTenantSlug}
          refreshKey={next.refreshKey}
          privateArea={next.privateArea}
          awaitSession={next.awaitSession}
        >
          <Navigator>
            <PrivateAreaGate>{next.content}</PrivateAreaGate>
          </Navigator>
        </AppProviders>
      )
      const result = render(view(route))
      return { go: (next: Route) => result.rerender(view(next)) }
    }
    /** Registra o escopo e os itens do carrinho que a rota encontra ao montar. */
    function mountProbe(
      label: string,
      seen: Array<{ name: string; items: string[] }>
    ) {
      return function MountProbe() {
        useEffect(() => {
          seen.push({
            name: useCartStore.persist.getOptions().name ?? '',
            items: useCartStore
              .getState()
              .items.map((entry) => entry.equipmentId),
          })
        }, [])
        return <h2>{label}</h2>
      }
    }

    beforeEach(() => {
      // O store do carrinho é do módulo: cada caso começa fora de qualquer escopo, como um app recém-aberto.
      useCartStore.persist.setOptions({ name: 'cart-unselected' })
      useCartStore.setState({ items: [] })
      window.localStorage.setItem(
        keyOf('locadora-a'),
        JSON.stringify({ state: { items: [stored('eq-A')] }, version: 0 })
      )
      window.localStorage.setItem(
        keyOf('locadora-b'),
        JSON.stringify({ state: { items: [stored('eq-B')] }, version: 0 })
      )
    })

    it('área do cliente aberta → /orcamento (awaitSession): a rota só monta com o carrinho já na locadora pública', async () => {
      const areaSeen: Array<{ name: string; items: string[] }> = []
      const quoteSeen: Array<{ name: string; items: string[] }> = []
      const Area = mountProbe('Área do cliente', areaSeen)
      const Seen = mountProbe('Orçamento', quoteSeen)
      // Como o `syncCartPricing` do OrcamentoPage: lê os itens ao montar e os regrava depois de um fetch.
      function Orcamento() {
        useEffect(() => {
          const captured = useCartStore.getState().items
          const timer = setTimeout(
            () => useCartStore.getState().hydrateItems(captured),
            10
          )
          return () => clearTimeout(timer)
        }, [])
        return <Seen />
      }
      const view = renderRoute({
        refreshKey: '/area-cliente',
        publicTenantSlug: null,
        privateArea: true,
        awaitSession: true,
        content: <Area />,
      })
      expect(await screen.findByText('Área do cliente')).toBeTruthy()
      expect(areaSeen).toEqual([{ name: keyOf('locadora-b'), items: ['eq-B'] }])

      view.go({
        refreshKey: '/orcamento',
        publicTenantSlug: 'locadora-a',
        privateArea: false,
        awaitSession: true,
        content: <Orcamento />,
      })
      expect(await screen.findByText('Orçamento')).toBeTruthy()
      expect(quoteSeen).toEqual([
        { name: keyOf('locadora-a'), items: ['eq-A'] },
      ])
      // O carrinho da locadora pública não recebe os itens da locadora da área.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
      expect(useCartStore.persist.getOptions().name).toBe(keyOf('locadora-a'))
      expect(
        useCartStore.getState().items.map((entry) => entry.equipmentId)
      ).toEqual(['eq-A'])
      expect(savedIn('locadora-a')).toEqual(['eq-A'])
      // Sair da área não apaga o carrinho salvo da locadora dela.
      expect(savedIn('locadora-b')).toEqual(['eq-B'])
      expect(navigatorLife).toEqual({ mounts: 1, unmounts: 0 })
    })

    it('/orcamento aberto → área do cliente: a área só monta com o carrinho já na locadora selecionada', async () => {
      const quoteSeen: Array<{ name: string; items: string[] }> = []
      const areaSeen: Array<{ name: string; items: string[] }> = []
      const Orcamento = mountProbe('Orçamento', quoteSeen)
      const Area = mountProbe('Área do cliente', areaSeen)
      const view = renderRoute({
        refreshKey: '/orcamento',
        publicTenantSlug: 'locadora-a',
        privateArea: false,
        awaitSession: true,
        content: <Orcamento />,
      })
      expect(await screen.findByText('Orçamento')).toBeTruthy()
      expect(quoteSeen).toEqual([
        { name: keyOf('locadora-a'), items: ['eq-A'] },
      ])

      view.go({
        refreshKey: '/area-cliente',
        publicTenantSlug: 'locadora-a',
        privateArea: true,
        awaitSession: true,
        content: <Area />,
      })
      expect(await screen.findByText('Área do cliente')).toBeTruthy()
      expect(areaSeen).toEqual([{ name: keyOf('locadora-b'), items: ['eq-B'] }])
      // Sair da vitrine para a área não apaga o carrinho salvo da locadora pública.
      expect(savedIn('locadora-a')).toEqual(['eq-A'])
      expect(navigatorLife).toEqual({ mounts: 1, unmounts: 0 })
    })
  })
})
