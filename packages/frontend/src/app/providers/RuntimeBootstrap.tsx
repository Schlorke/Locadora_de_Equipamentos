'use client'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Button, Stack, Text } from '@gb-locacoes/ui'
import { ApiClientProvider, type HttpClient } from '../../shared/api'
import {
  ApplicationSessionProvider,
  sessionStatusOf,
  toApplicationSession,
  type ApplicationSession,
  type SessionAdapter,
  type SessionSnapshot,
  type SessionState,
} from '../../entities/sessao'
import {
  TenantProvider,
  PublicTenantProvider,
  type TenantContext,
} from '../../entities/organizacao'
import {
  useTenantSelection,
  useHostTenantMembership,
  useTenantSuggestion,
  TenantSelector,
  HostMembershipNotice,
} from '../../features/selecionar-locadora'
import { switchCartScope, useCartSync } from '../../features/carrinho'
import { signInHref } from '../../features/entrar'
import { resolveAdminRoleRedirect } from '../../features/entrar-admin'
import {
  toVisiblePathname,
  useHrefResolver,
  useInternalRoutePrefix,
  type HrefResolver,
} from '../../shared/lib/navigation'
import { readCurrentQuery } from './current-query'

/**
 * Como a locadora da área privada é resolvida.
 * - `selection` (painel no app, mobile, legado): seleção explícita validada por membership (`TenantSelector`,
 *   `x-tenant-id`), com a confirmação do `?locadora=` quando diverge da seleção atual.
 * - `host` (host de locadora): a locadora é a do host, via `GET /api/auth/organizations/current`; sem seletor e sem
 *   `x-tenant-id`; sem vínculo (404 `NO_MEMBERSHIP`), a tela de vínculo.
 */
export type TenantMode = 'selection' | 'host'
/** Tela de vínculo explícito com a locadora do host (grupo `(auth)` do host de locadora). */
export const TENANT_ENROLLMENT_PATH = '/vincular'

/**
 * Troca a rota atual pelo destino sem deixá-la no histórico, como um redirecionamento do servidor: no navegador,
 * `location.replace` com o href resolvido pelo host (o "voltar" não cai de novo na rota que redireciona); sem
 * `location` (app), a navegação do host, que já resolve o href.
 */
function replaceRoute(
  href: string,
  resolveHref: HrefResolver | null,
  navigate: ((href: string) => void | Promise<void>) | undefined
) {
  const location = (
    globalThis as { location?: { replace?: (url: string) => void } }
  ).location
  if (typeof location?.replace === 'function') {
    location.replace(resolveHref ? resolveHref(href) : href)
    return
  }
  void navigate?.(href)
}

export interface RuntimeBootstrapProps {
  children: ReactNode
  auth: SessionAdapter
  apiClient: HttpClient
  navigate?: (href: string) => void | Promise<void>
  publicTenantSlug: string | null
  privateArea: boolean
  persistSelection?: boolean
  onTenantSelected?: (selection: TenantContext) => void
  /**
   * Caminho visível da rota atual, sem query (web: o de `useVisiblePathname`; app: o da tela focada). Mudar revalida a
   * sessão; é também o retorno (`callbackUrl`) do "Entrar" da área privada, com a query da URL no web.
   */
  refreshKey?: string
  /** Sessão já lida pelo host (ex.: no servidor). `undefined` = desconhecida: começa em 'loading' e consulta `auth.getSession()`. */
  initialSession?: SessionSnapshot
  /** Rotas que dependem da sessão/carrinho no primeiro render esperam por eles; o padrão renderiza os filhos imediatamente. */
  awaitSession?: boolean
  /** Padrão: `host` quando a árvore está no modo host do roteamento público (prefixo interno `/{slug}`), senão `selection`. */
  tenantMode?: TenantMode
}

/** O que o `PrivateAreaGate` precisa para decidir o conteúdo de uma área; fornecido pelo `RuntimeBootstrap`. */
interface AreaGateState {
  /** A rota atual do host é área privada. */
  privateArea: boolean
  /** A rota atual espera sessão e escopo do carrinho (ex.: /orcamento). */
  awaitSession: boolean
  status: SessionState['status']
  sessionError: string | null
  /**
   * A leitura da sessão da rota atual ainda não respondeu. O status é então o da leitura anterior (ex.: o
   * 'unauthenticated' de um erro que o "Tentar novamente" acabou de limpar, ou o da rota de onde se veio) e não confirma
   * visitante.
   */
  sessionPending: boolean
  /** O carrinho já está no escopo da rota atual (locadora + usuário). */
  scopeReady: boolean
  cartError: string | null
  /** Há locadora selecionada e nenhuma troca em andamento. */
  hasSelection: boolean
  selector: ReactNode
  /** Pedido de login da área privada (no modo host, sem falar em seleção de locadora). */
  signInMessage: string
  signIn: () => void
  /**
   * Sem sessão, a área que segue a rota (web) vai direto ao login, sem o pedido de login: o painel (modo seleção, host
   * `app`). Na vitrine (modo host) o pedido continua; depois de um "Sair" nesta árvore também (quem saiu escolheu o
   * destino no `callbackUrl`).
   */
  redirectsToSignIn: boolean
  /** Troca a rota atual pelo login (mesmo destino do "Entrar"), sem deixá-la no histórico. */
  redirectToSignIn: () => void
  /**
   * Destino da rota atual do painel pelo papel do vínculo com a locadora atual (onda 135, A6: FINANCIAL só no
   * financeiro, configurações só para ADMIN), ou `null`. Só o portão que segue a rota (web) o aplica.
   */
  roleRedirect: string | null
  /** Troca a rota atual pelo destino, sem deixá-la no histórico (como `redirectToSignIn`). */
  replaceWith: (href: string) => void
  retry: () => void
}
const AreaGateContext = createContext<AreaGateState | null>(null)
const PrivateAreaHeaderContext = createContext<ReactNode>(null)

/** Seletor existente entregue à moldura, depois da mesma decisão do gate. */
export function usePrivateAreaHeader() {
  return useContext(PrivateAreaHeaderContext)
}

export function RuntimeBootstrap({
  children,
  auth,
  apiClient,
  navigate,
  publicTenantSlug,
  privateArea,
  refreshKey,
  persistSelection,
  onTenantSelected,
  initialSession,
  awaitSession = false,
  tenantMode,
}: RuntimeBootstrapProps) {
  const [identity, setIdentity] = useState<ApplicationSession>(() =>
      toApplicationSession(initialSession)
    ),
    [status, setStatus] = useState<SessionState['status']>(() =>
      initialSession === undefined
        ? 'loading'
        : sessionStatusOf(toApplicationSession(initialSession))
    ),
    [sessionError, setSessionError] = useState<string | null>(null),
    sessionRevision = useRef(0),
    [membershipRevision, setMembershipRevision] = useState(0)
  const internalRoutePrefix = useInternalRoutePrefix(),
    hostMode =
      (tenantMode ?? (internalRoutePrefix !== null ? 'host' : 'selection')) ===
      'host'
  // A sessão entregue pelo host vale para a rota em que foi lida: não repete getSession nela, só nas navegações seguintes.
  const seededKey = useRef<{ key: string | undefined } | null>(
    initialSession === undefined ? null : { key: refreshKey }
  )
  // "Sair" nesta árvore: o destino é o `callbackUrl` de quem saiu, não o login automático do painel (até a próxima leitura).
  const [signedOutHere, setSignedOutHere] = useState(false)
  // Rota cuja leitura da sessão já respondeu (ou em que o host a entregou); `null` com uma leitura em andamento. O status
  // só vale para essa rota: numa rota nova (antes mesmo do efeito que a relê) ou com uma leitura pendente, é o anterior.
  const currentKey = useRef(refreshKey)
  currentKey.current = refreshKey
  const [answeredKey, setAnsweredKey] = useState<{
    key: string | undefined
  } | null>(() => (initialSession === undefined ? null : { key: refreshKey }))
  const refresh = useCallback(async () => {
    const version = ++sessionRevision.current,
      key = currentKey.current
    setSessionError(null)
    setSignedOutHere(false)
    setAnsweredKey(null)
    try {
      const session = toApplicationSession(await auth.getSession())
      if (version === sessionRevision.current) {
        setIdentity(session)
        setStatus(sessionStatusOf(session))
        setAnsweredKey({ key })
      }
      return session
    } catch (e) {
      if (version === sessionRevision.current) {
        setIdentity(null)
        setStatus('unauthenticated')
        setSessionError(
          e instanceof Error ? e.message : 'Não foi possível acessar a sessão.'
        )
        setAnsweredKey({ key })
      }
      return null
    }
  }, [auth])
  const sessionPending = answeredKey === null || answeredKey.key !== refreshKey
  useEffect(() => {
    if (seededKey.current && seededKey.current.key === refreshKey) return
    seededKey.current = null
    void refresh()
    return () => {
      sessionRevision.current++
    }
  }, [refresh, refreshKey])
  const userId = identity?.user?.id ?? null
  // Os dois hooks ficam sempre montados (ordem estável); só o do modo atual consulta a API.
  const tenant = useTenantSelection(hostMode ? null : userId, {
      persistSelection,
    }),
    host = useHostTenantMembership(hostMode ? userId : null, {
      revision: membershipRevision,
    })
  const current = hostMode ? host.membership : tenant.selection,
    currentLoading = hostMode ? host.status === 'loading' : tenant.loading
  // No modo host a locadora é só a do host: nenhum x-tenant-id sai do cliente.
  const selectedTenantId = hostMode
    ? null
    : (tenant.selection?.tenant.id ?? null)
  const scopedClient = useMemo<HttpClient>(
    () => ({
      async request<T>(path: string, options = {}) {
        return apiClient.request<T>(path, {
          ...options,
          headers: {
            ...('headers' in options
              ? (options.headers as Record<string, string>)
              : {}),
            ...(selectedTenantId ? { 'x-tenant-id': selectedTenantId } : {}),
          },
        })
      },
    }),
    [apiClient, selectedTenantId]
  )
  const effectiveSlug =
    !hostMode && privateArea && tenant.selection
      ? tenant.selection.tenant.slug
      : publicTenantSlug
  const scope =
      status === 'loading'
        ? null
        : effectiveSlug
          ? JSON.stringify([effectiveSlug, userId ?? 'anonymous'])
          : null,
    [readyScope, setReadyScope] = useState<string | null | undefined>(
      undefined
    ),
    [cartError, setCartError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setReadyScope(undefined)
    setCartError(null)
    void switchCartScope(scope)
      .then((current) => {
        if (active && current) setReadyScope(scope)
      })
      .catch(() => {
        if (active)
          setCartError('Não foi possível abrir o carrinho desta locadora.')
      })
    return () => {
      active = false
    }
  }, [scope])
  // O cliente da escrita captura a seleção: uma chamada atrasada nunca usa o x-tenant-id da seleção seguinte.
  const cartTenantId = hostMode ? null : (current?.tenant.id ?? null)
  const cartClient = useMemo<HttpClient>(
    () => ({
      request<T>(path: string, options = {}) {
        return apiClient.request<T>(path, {
          ...options,
          headers: {
            ...('headers' in options
              ? (options.headers as Record<string, string>)
              : {}),
            ...(cartTenantId ? { 'x-tenant-id': cartTenantId } : {}),
          },
        })
      },
    }),
    [apiClient, cartTenantId]
  )
  const cartSync = useCartSync({
    client: cartClient,
    scope:
      status === 'authenticated' &&
      !sessionPending &&
      readyScope === scope &&
      !currentLoading &&
      current?.role === 'CLIENT' &&
      current.tenant.slug === effectiveSlug
        ? scope
        : null,
  })
  // No modo host, sair encerra só a sessão deste host; não há seleção a limpar (a rota de seleção nem existe ali).
  const signOut = useCallback(
    async (options?: { callbackUrl?: string }) => {
      try {
        if (!hostMode) await tenant.clear()
      } finally {
        await auth.signOut()
        setSignedOutHere(true)
        setIdentity(null)
        setStatus('unauthenticated')
        await switchCartScope(null)
        if (options?.callbackUrl) await navigate?.(options.callbackUrl)
      }
    },
    [auth, hostMode, tenant.clear, navigate]
  )
  const session = identity?.user
    ? { ...identity, user: { ...identity.user, role: current?.role ?? null } }
    : identity
  // `update()` explícito (ex.: depois do vínculo) também reconsulta o vínculo com a locadora do host; navegar não.
  const update = useCallback(async () => {
    const next = await refresh()
    setMembershipRevision((value) => value + 1)
    return next
  }, [refresh])
  const value = { data: session, status, update, signOut }
  const tenantSelect = tenant.select,
    selectTenant = useCallback(
      (id: string) =>
        tenantSelect(id).then((selected) => {
          if (selected) onTenantSelected?.(selected)
          return selected
        }),
      [tenantSelect, onTenantSelected]
    )
  const suggestion = useTenantSuggestion({
    memberships: hostMode ? [] : tenant.memberships,
    selection: tenant.selection,
    loading: tenant.loading,
    select: selectTenant,
    readKey: refreshKey,
  })
  const hasSelection = !!current && !currentLoading
  // Modo host: nenhum seletor; sem vínculo ativo, o aviso que leva à tela de vínculo.
  const selector = hostMode ? (
    hasSelection ? null : (
      <HostMembershipNotice
        status={host.status}
        error={host.error}
        onEnroll={() => {
          void navigate?.(TENANT_ENROLLMENT_PATH)
        }}
        onRetry={() => {
          void host.refresh()
        }}
      />
    )
  ) : (
    <TenantSelector
      {...tenant}
      onSelect={(id) => {
        void selectTenant(id)
      }}
      onRetry={() => {
        void tenant.refresh()
      }}
      suggestion={suggestion.pending}
      onConfirmSuggestion={suggestion.accept}
      onDismissSuggestion={suggestion.dismiss}
    />
  )
  // A query é lida no uso (no web, da URL do navegador; no app não há).
  const routePath =
    refreshKey === undefined
      ? undefined
      : toVisiblePathname(refreshKey, internalRoutePrefix)
  const signInTarget = () =>
    signInHref(
      routePath,
      routePath === undefined ? '' : readCurrentQuery(routePath)
    )
  const signIn = () => {
    void navigate?.(signInTarget())
  }
  const resolveHref = useHrefResolver()
  const redirectToSignIn = () => {
    replaceRoute(signInTarget(), resolveHref, navigate)
  }
  // Papel do vínculo com a locadora atual nas rotas do painel; sem rota conhecida ou sem locadora, nada.
  const roleRedirect =
    routePath === undefined || !current || currentLoading
      ? null
      : resolveAdminRoleRedirect(routePath, current.role)
  const gate: AreaGateState = {
    privateArea,
    awaitSession,
    status,
    sessionError,
    sessionPending,
    scopeReady: readyScope === scope && cartSync.isReady,
    cartError,
    hasSelection,
    selector,
    signInMessage: hostMode
      ? 'Entre na sua conta para acessar a área do cliente.'
      : 'Entre na sua conta para selecionar uma locadora.',
    signIn,
    redirectsToSignIn: !hostMode && !signedOutHere,
    redirectToSignIn,
    roleRedirect,
    replaceWith: (href) => {
      replaceRoute(href, resolveHref, navigate)
    },
    retry: () => {
      void refresh()
    },
  }
  // Os filhos (o navegador do host: <Stack/> no Expo Router, a árvore de rotas no Next) ficam sempre montados e na mesma
  // posição: trocá-los desmontaria o navegador e zeraria o estado de navegação. O portão de área privada/awaitSession é
  // aplicado dentro da área pelo PrivateAreaGate; aqui só o aviso de carrinho das rotas públicas.
  const publicCartError =
    cartError && !(awaitSession || privateArea) ? (
      <Stack padding="md">
        <Text>{cartError}</Text>
      </Stack>
    ) : null
  const syncError = cartSync.error ? (
    <Stack padding="md">
      <Text>{cartSync.error}</Text>
      <Button variant="outline" onClick={cartSync.retry}>
        Tentar sincronizar
      </Button>
    </Stack>
  ) : null
  return (
    <ApplicationSessionProvider value={value}>
      <TenantProvider value={current}>
        <ApiClientProvider client={scopedClient}>
          <PublicTenantProvider value={effectiveSlug}>
            <AreaGateContext.Provider value={gate}>
              {publicCartError}
              {syncError}
              {children}
            </AreaGateContext.Provider>
          </PublicTenantProvider>
        </ApiClientProvider>
      </TenantProvider>
    </ApplicationSessionProvider>
  )
}

/**
 * Portão de área privada (e das rotas com `awaitSession`), aplicado DENTRO da área: no web envolve o conteúdo da
 * rota no ClientLayoutShell; no Expo Router envolve cada tela pelo `screenLayout` do Stack. O navegador nunca é trocado.
 *
 * - `privateArea` omitido: segue a rota atual do host (web: uma rota por vez; inclui `awaitSession`).
 * - `privateArea` informado: a própria tela é privada (mobile). Enquanto a rota atual do host não é esta área (primeiro
 *   quadro da navegação ou tela de fundo da pilha), mantém o conteúdo já aberto e, se ainda não abriu, mostra a espera.
 *
 * A tela privada do mobile já aberta não fecha só pela troca do escopo do carrinho (ex.: voltar da vitrine para a
 * tela que ficou na pilha): o conteúdo é o mesmo; fecha com sessão encerrada, troca de locadora ou erro do carrinho.
 * No web (`privateArea` omitido) o conteúdo muda com a rota, então toda rota da área ou com `awaitSession` só monta
 * com o carrinho já no escopo dela, inclusive vindo de outra rota já aberta (ex.: área do cliente → /orcamento).
 *
 * Sem sessão (visitante confirmado, sem erro ao ler a sessão), a rota privada do painel no web (`privateArea` omitido,
 * modo seleção) vai direto ao login com retorno para ela, sem o pedido de login. Visitante confirmado é o da leitura
 * que já respondeu: com uma leitura em andamento (ex.: "Tentar novamente" depois de um erro, ou a leitura da rota nova)
 * o painel espera a resposta. A vitrine (modo host) e as telas do app (`privateArea` informado) continuam com o pedido
 * e o botão "Entrar"; com erro ao ler a sessão, também.
 *
 * Com a sessão e a locadora já resolvidas, a rota do painel no web que o papel do vínculo não abre (onda 135, A6:
 * FINANCIAL fora do financeiro, configurações para quem não é ADMIN; `resolveAdminRoleRedirect`) não monta e é trocada
 * pelo destino, sem ficar no histórico, como o layout do painel da raiz legada fazia. A API continua exigindo a
 * permissão de cada rota.
 */
export function PrivateAreaGate({
  children,
  privateArea,
  headerInContent = false,
}: {
  children: ReactNode
  privateArea?: boolean
  /** Painel web: a moldura coloca o seletor abaixo dos seus cabeçalhos fixos. */
  headerInContent?: boolean
}) {
  const gate = useContext(AreaGateContext),
    opened = useRef(false)
  const followsRoute = privateArea === undefined
  const isPrivate = followsRoute ? !!gate?.privateArea : !!privateArea
  const guarded =
    !!gate &&
    (followsRoute ? gate.privateArea || gate.awaitSession : !!privateArea)
  // Painel sem sessão e sem erro: vai ao login só com a leitura já respondida; com uma leitura pendente, o status é o da
  // anterior (ex.: o de um erro que acabou de ser limpo) e o painel espera a resposta.
  const panelVisitor =
    !!gate &&
    followsRoute &&
    isPrivate &&
    gate.redirectsToSignIn &&
    gate.status === 'unauthenticated' &&
    !gate.sessionError
  const awaitingRead = panelVisitor && !!gate?.sessionPending,
    redirecting = panelVisitor && !awaitingRead
  // A troca de rota sai uma vez a cada entrada no estado (o destino é lido na hora, com a query da URL).
  const redirectToSignIn = useRef(gate?.redirectToSignIn)
  redirectToSignIn.current = gate?.redirectToSignIn
  useEffect(() => {
    if (redirecting) redirectToSignIn.current?.()
  }, [redirecting])
  const replaceWith = useRef(gate?.replaceWith)
  replaceWith.current = gate?.replaceWith
  // Só a tela que continua montada (mobile) atravessa a troca de escopo aberta.
  const keepsOpenScreen = !followsRoute && opened.current
  let top: ReactNode = null,
    body: ReactNode = children,
    open = true,
    // Rota do painel que o papel do vínculo não abre (web): a rota não monta e é trocada pelo destino.
    roleTarget: string | null = null
  if (gate && guarded) {
    const signedIn = gate.status === 'authenticated',
      waiting = (
        <Stack padding="md">
          <Text>{gate.cartError ?? 'Carregando...'}</Text>
        </Stack>
      )
    if (redirecting) {
      open = false
      body = (
        <Stack padding="md">
          <Text>Redirecionando...</Text>
        </Stack>
      )
    } else if (!followsRoute && !gate.privateArea) {
      open = opened.current && signedIn && gate.hasSelection
      if (!open) body = waiting
    } else if (
      gate.status === 'loading' ||
      awaitingRead ||
      gate.cartError ||
      (!gate.scopeReady && !keepsOpenScreen)
    ) {
      open = false
      body = waiting
    } else if (isPrivate && !signedIn) {
      open = false
      body = (
        <Stack padding="md">
          <Text>{gate.sessionError ?? gate.signInMessage}</Text>
          <Button onClick={gate.signIn}>Entrar</Button>
          {gate.sessionError && (
            <Button variant="outline" onClick={gate.retry}>
              Tentar novamente
            </Button>
          )}
        </Stack>
      )
    } else if (isPrivate) {
      top = gate.selector
      open = gate.hasSelection
      if (!open) body = null
      else if (followsRoute && gate.roleRedirect) {
        roleTarget = gate.roleRedirect
        open = false
        top = null
        body = (
          <Stack padding="md">
            <Text>Redirecionando...</Text>
          </Stack>
        )
      }
    }
  }
  // A troca pelo papel sai uma vez a cada entrada no estado (onda 135, A6).
  useEffect(() => {
    if (roleTarget) replaceWith.current?.(roleTarget)
  }, [roleTarget])
  const openNow = guarded && open
  useEffect(() => {
    opened.current = openNow
  }, [openNow])
  // `children` fica sempre na segunda posição: o seletor aparecer ou sumir não remonta o conteúdo da área.
  // Sem seleção o conteúdo fica fechado; o seletor deve continuar visível fora da moldura.
  const containedHeader = headerInContent && open
  return (
    <PrivateAreaHeaderContext.Provider value={containedHeader ? top : null}>
      {containedHeader ? null : top}
      {body}
    </PrivateAreaHeaderContext.Provider>
  )
}
