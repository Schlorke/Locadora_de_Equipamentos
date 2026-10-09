/**
 * Decisão do proxy do host web (docs/architecture/adr-tenant-hosts.md, D1–D5 e tabela 4.2).
 *
 * Pura: recebe o ambiente já validado, a classe do Host (`classifyHost`) e o alvo da requisição, e devolve o que
 * fazer. Não lê cabeçalhos, cookies, ambiente, disco, banco nem rede; o `proxy.ts` só aplica a decisão.
 */
import {
  isTenantSlug,
  platformOrigins,
  tenantOrigin,
  type HostClass,
  type PlatformEdgeHostKind,
  type PlatformEnv,
} from '@gb-locacoes/contracts/platform'
import type { HostAuthMode } from '../auth/mode'
import {
  APEX_API_ROUTES,
  APEX_WELL_KNOWN,
  APP_HOST_PATHS,
  LABS_PATHS,
  LOCAL_API_ROUTES,
  PUBLIC_TENANT_QUERY_ROUTES,
  TENANT_ACCOUNT_PATHS,
  betterAuthBasePath,
  isApiPath,
  isBlockedApi,
  isPublicPassthrough,
  isTenantApiAllowed,
  matchesAny,
} from './route-table'

/** Parte do ambiente que a decisão usa. */
export type DecideEnv = Pick<PlatformEnv, 'rootDomain' | 'protocol' | 'publicPort' | 'labsEnabled'> & {
  /**
   * Modo de autenticação do host web (`NEXT_PUBLIC_AUTH_MODE`, `host/auth/mode.ts`). Decide se o host de locadora tem
   * login e área do cliente (fora do `legacy`, desenho 4.6) e em qual `basePath` do Better Auth a API de entrada do
   * cliente passa (`betterAuthBasePath`). Ausente conta como `legacy` (falha fechada).
   */
  readonly authMode?: HostAuthMode
}

/** Contexto de borda que o proxy envia ao backend (sem o segredo e sem o IP, que o proxy acrescenta). */
export interface EdgeContext {
  readonly hostKind: PlatformEdgeHostKind
  readonly tenantSlug: string | null
  readonly origin: string
}

export type Decision =
  | { readonly type: 'next' }
  | { readonly type: 'rewrite'; readonly pathname: string; readonly search: string }
  | {
      readonly type: 'backend'
      readonly pathname: string
      readonly search: string
      readonly edge: EdgeContext
      /** Remove `selected-tenant-id` do `Cookie` repassado (hosts de locadora). */
      readonly stripSelectionCookie: boolean
    }
  | { readonly type: 'redirect'; readonly location: string; readonly status: 307 | 308 }
  | {
      readonly type: 'respond'
      readonly status: number
      readonly body: string
      readonly headers: Readonly<Record<string, string>>
    }

export type RespondDecision = Extract<Decision, { readonly type: 'respond' }>

export interface RequestTarget {
  /** `request.nextUrl.pathname`, como chegou (pode vir com percent-encoding). */
  readonly pathname: string
  /** `request.nextUrl.search`, com o `?` inicial ou vazio. */
  readonly search: string
  readonly method: string
}

export const TENANT_QUERY_PARAM = 'tenantSlug'
export const PANEL_TENANT_PARAM = 'locadora'

const NO_STORE = 'no-store'

/** 404 JSON das APIs negadas ou inexistentes no host (mesmo envelope do `notFoundResponse` do backend). */
export function apiNotFound(): RespondDecision {
  return {
    type: 'respond',
    status: 404,
    body: JSON.stringify({ error: 'Not Found', message: 'Endpoint não encontrado', code: 'NOT_FOUND' }),
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': NO_STORE },
  }
}

/** 400 de seleção de locadora divergente do host (mesmo corpo de `resolvePublicRequestTenant`). */
export function tenantConflict(): RespondDecision {
  return {
    type: 'respond',
    status: 400,
    body: JSON.stringify({ error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' }),
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': NO_STORE },
  }
}

/** Corpo do 404 neutro de página (host reservado ou inválido, locadora divergente). */
export const NEUTRAL_NOT_FOUND_HTML =
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Página não encontrada</title></head>' +
  '<body><main><h1>Página não encontrada</h1><p>O endereço acessado não existe.</p></main></body></html>'

/** 404 neutro de página, `noindex`, sem cache (D10). */
export function pageNotFound(): RespondDecision {
  return {
    type: 'respond',
    status: 404,
    body: NEUTRAL_NOT_FOUND_HTML,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': NO_STORE,
      'x-robots-tag': 'noindex, nofollow',
    },
  }
}

/** `robots.txt` do host `app`: nada indexável. */
export function appRobots(): RespondDecision {
  return {
    type: 'respond',
    status: 200,
    body: 'User-agent: *\nDisallow: /\n',
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  }
}

/** 503 quando o ambiente da plataforma é inválido ou não permite repassar APIs (falha fechada). */
export function platformUnavailable(api: boolean): RespondDecision {
  return api
    ? {
        type: 'respond',
        status: 503,
        body: JSON.stringify({ error: 'Plataforma indisponível', code: 'PLATFORM_UNAVAILABLE' }),
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': NO_STORE },
      }
    : {
        type: 'respond',
        status: 503,
        body:
          '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
          '<title>Indisponível</title></head><body><main><h1>Serviço indisponível</h1></main></body></html>',
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': NO_STORE, 'x-robots-tag': 'noindex' },
      }
}

/**
 * Caminho canônico: cada segmento decodificado uma vez. Recusa (null) o que um backend poderia interpretar de
 * outra forma que a decisão: codificação malformada, `/` ou `\` codificados, NUL, `.` e `..`.
 * A decisão é tomada sobre o caminho canônico e o destino recebe esse mesmo caminho, reencodado.
 */
export function canonicalPathname(raw: string): { readonly decoded: string; readonly encoded: string } | null {
  if (!raw.startsWith('/')) return null
  const decodedSegments: string[] = []
  const encodedSegments: string[] = []
  for (const segment of raw.split('/').slice(1)) {
    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      return null
    }
    const separatorOrNul = decoded.includes('/') || decoded.includes('\\') || decoded.includes(String.fromCharCode(0))
    if (separatorOrNul || decoded === '.' || decoded === '..') return null
    decodedSegments.push(decoded)
    encodedSegments.push(encodeURIComponent(decoded))
  }
  return { decoded: '/' + decodedSegments.join('/'), encoded: '/' + encodedSegments.join('/') }
}

/** Valores não vazios de um parâmetro de query. */
function explicitValues(params: URLSearchParams, name: string): string[] {
  return params
    .getAll(name)
    .map((value) => value.trim())
    .filter((value) => value !== '')
}

function searchOf(params: URLSearchParams): string {
  const text = params.toString()
  return text === '' ? '' : '?' + text
}

function withoutParam(search: string, name: string): string {
  const params = new URLSearchParams(search)
  params.delete(name)
  return searchOf(params)
}

/** Remove um cookie do valor do cabeçalho `Cookie` (nome exato), preservando os demais na ordem original. */
export function withoutCookie(cookieHeader: string | null, name: string): string {
  if (!cookieHeader) return ''
  const cookieName = (pair: string) => {
    const separator = pair.indexOf('=')
    return (separator === -1 ? pair : pair.slice(0, separator)).trim()
  }
  return cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .filter((pair) => pair !== '' && cookieName(pair) !== name)
    .join('; ')
}

function internalPrefixed(prefix: string, pathname: string): string {
  return pathname === '/' ? prefix : prefix + pathname
}

/** Caminhos internos do Next (`/_next/*` fora do matcher, `/__nextjs*` do servidor de desenvolvimento). */
function isNextInternal(pathname: string): boolean {
  return pathname.startsWith('/_next/') || pathname.startsWith('/__nextjs')
}

export function decide(env: DecideEnv, host: HostClass, target: RequestTarget): Decision {
  if (host.kind === 'invalid' || host.kind === 'reserved') {
    return isApiPath(target.pathname) ? apiNotFound() : pageNotFound()
  }
  const canonical = canonicalPathname(target.pathname)
  const api = isApiPath(canonical?.decoded ?? target.pathname)
  if (canonical === null) return api ? apiNotFound() : pageNotFound()
  const pathname = canonical.decoded
  const encodedPath = canonical.encoded
  const search = target.search

  if (host.kind === 'www') {
    return { type: 'redirect', status: 308, location: platformOrigins(env, host).apex + encodedPath + search }
  }
  if (api && isBlockedApi(pathname)) return apiNotFound()
  if (isNextInternal(pathname)) return { type: 'next' }

  if (host.kind === 'apex') {
    if (api) {
      if (!matchesAny(pathname, APEX_API_ROUTES)) return apiNotFound()
      return backend(encodedPath, search, { hostKind: 'apex', tenantSlug: null, origin: host.origin }, false)
    }
    const requested = new Set(explicitValues(new URLSearchParams(search), TENANT_QUERY_PARAM))
    const [only] = requested
    if (requested.size === 1 && only !== undefined && isTenantSlug(only)) {
      return {
        type: 'redirect',
        status: 308,
        location: tenantOrigin(env, only, host) + encodedPath + withoutParam(search, TENANT_QUERY_PARAM),
      }
    }
    const wellKnown = /^\/\.well-known\/([^/]+)$/.exec(pathname)?.[1]
    if (wellKnown !== undefined && APEX_WELL_KNOWN.includes(wellKnown)) {
      return { type: 'rewrite', pathname: '/plataforma/well-known/' + encodeURIComponent(wellKnown), search }
    }
    if (isPublicPassthrough(pathname)) return { type: 'next' }
    return { type: 'rewrite', pathname: internalPrefixed('/plataforma', encodedPath), search }
  }

  if (host.kind === 'app') {
    if (api) {
      if (matchesAny(pathname, LOCAL_API_ROUTES)) return { type: 'next' }
      return backend(encodedPath, search, { hostKind: 'app', tenantSlug: null, origin: host.origin }, false)
    }
    // Labs antes do painel: /admin/teste-toast é laboratório, não painel.
    if (matchesAny(pathname, LABS_PATHS)) return env.labsEnabled ? { type: 'next' } : pageNotFound()
    if (matchesAny(pathname, APP_HOST_PATHS)) return { type: 'next' }
    if (pathname === '/') return { type: 'redirect', status: 307, location: host.origin + '/admin' + search }
    if (pathname === '/robots.txt') return appRobots()
    if (isPublicPassthrough(pathname)) return { type: 'next' }
    return pageNotFound()
  }

  // Host de locadora: a locadora é o rótulo do Host e nada da requisição a troca (D1).
  const slug = host.slug
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const params = new URLSearchParams(search)
    params.set(PANEL_TENANT_PARAM, slug)
    return { type: 'redirect', status: 308, location: platformOrigins(env, host).app + encodedPath + searchOf(params) }
  }
  const params = new URLSearchParams(search)
  const requested = explicitValues(params, TENANT_QUERY_PARAM)
  if (api) {
    if (!isTenantApiAllowed(pathname, env.authMode)) return apiNotFound()
    if (requested.some((value) => value !== slug)) return tenantConflict()
    let forwardedSearch = search
    const method = target.method.toUpperCase()
    if ((method === 'GET' || method === 'HEAD') && requested.length === 0 && matchesAny(pathname, PUBLIC_TENANT_QUERY_ROUTES)) {
      params.delete(TENANT_QUERY_PARAM)
      params.append(TENANT_QUERY_PARAM, slug)
      forwardedSearch = searchOf(params)
    }
    return backend(encodedPath, forwardedSearch, { hostKind: 'tenant', tenantSlug: slug, origin: host.origin }, true)
  }
  if (requested.length > 0) {
    if (requested.some((value) => value !== slug)) return pageNotFound()
    return { type: 'redirect', status: 308, location: host.origin + encodedPath + withoutParam(search, TENANT_QUERY_PARAM) }
  }
  if (isPublicPassthrough(pathname)) return { type: 'next' }
  if (betterAuthBasePath(env.authMode) === null && matchesAny(pathname, TENANT_ACCOUNT_PATHS)) return pageNotFound()
  return { type: 'rewrite', pathname: internalPrefixed('/' + slug, encodedPath), search }
}

function backend(pathname: string, search: string, edge: EdgeContext, stripSelectionCookie: boolean): Decision {
  return { type: 'backend', pathname, search, edge, stripSelectionCookie }
}
