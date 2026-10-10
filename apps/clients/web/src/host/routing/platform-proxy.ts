/**
 * Aplica a decisão pura (`decide`) a uma requisição do Next. Separado de `src/proxy.ts` para que os testes criem o
 * proxy com um ambiente próprio; `apps/clients/web/src/proxy.ts` só exporta a instância com o ambiente do processo e o `matcher`.
 *
 * Nada aqui consulta banco (D2): a existência da locadora é checada pelo layout ou pelo handler. A única leitura é a
 * do modo do site (S13), injetada: as páginas não conseguem escolher o status HTTP, então só o proxy entrega a
 * vitrine em pausa com 503 de verdade e a vitrine desligada com o 404 neutro (a página que espera a sessão não chega a
 * renderizar o `notFound()` do layout no servidor). A regra é do backend; aqui se lê o cartão público e se aplica a
 * resposta; o layout da vitrine continua decidindo quando a leitura falha.
 */
import { NextResponse, type NextRequest } from 'next/server'
import {
  PLATFORM_EDGE_HEADER,
  PLATFORM_EDGE_HEADERS,
  classifyHost,
  type PlatformEnv,
} from '@gb-locacoes/contracts/platform'
import { TENANT_COOKIE_NAME } from '@gb-locacoes/contracts'
import {
  decide,
  platformUnavailable,
  withoutCookie,
  type DecideEnv,
  type RespondDecision,
} from './decide'
import { isApiPath } from './route-table'
import type { SiteStateReader } from '../server/site-state'
import {
  PAUSED_LEGAL_PAGE_HEADERS,
  pausedSiteServes,
  siteNotFoundRewrite,
  sitePausedRewrite,
  storefrontSlug,
} from './site-mode'

/** Ambiente do proxy: o da plataforma mais o modo de autenticação do host web (conta do cliente no host de locadora). */
export type ProxyEnv = PlatformEnv & Pick<DecideEnv, 'authMode'>

/** Lê o ambiente validado; `null` quando inválido (o proxy responde 503, falha fechada). */
export type PlatformEnvReader = () => ProxyEnv | null

function respond(decision: RespondDecision): NextResponse {
  return new NextResponse(decision.body, {
    status: decision.status,
    headers: decision.headers,
  })
}

/**
 * Proxy do host web. Com `siteState` (o do processo), a página da vitrine consulta o modo do site no backend (S13) e
 * pode responder 503; sem ele, só a decisão pura, e nenhum ramo devolve Promise.
 */
export function createPlatformProxy(
  readEnv: PlatformEnvReader,
  siteState?: SiteStateReader
) {
  return function platformProxy(
    request: NextRequest
  ): NextResponse | Promise<NextResponse> {
    const env = readEnv()
    const { pathname, search } = request.nextUrl
    if (env === null) {
      return respond(platformUnavailable(isApiPath(pathname)))
    }
    // Cabeçalhos de borda nunca atravessam vindos do cliente: só o proxy os define (D5).
    const headers = new Headers(request.headers)
    for (const name of PLATFORM_EDGE_HEADERS) headers.delete(name)

    const host = classifyHost(request.headers.get('host'), env)
    const decision = decide(env, host, {
      pathname,
      search,
      method: request.method,
    })
    switch (decision.type) {
      case 'next':
        return NextResponse.next({ request: { headers } })
      case 'rewrite': {
        const rewrite = (
          target: string = decision.pathname,
          init: {
            status?: number
            headers?: Readonly<Record<string, string>>
          } = {}
        ) =>
          NextResponse.rewrite(new URL(target + decision.search, request.url), {
            ...(init.status === undefined ? {} : { status: init.status }),
            ...(init.headers === undefined
              ? {}
              : { headers: { ...init.headers } }),
            request: { headers },
          })
        const slug = storefrontSlug(host, decision.pathname)
        if (siteState === undefined || env.apiOrigin === null || slug === null)
          return rewrite()
        // Sem resposta do backend, segue o rewrite: o layout da vitrine decide (404, erro ou a página).
        return siteState(env.apiOrigin, slug).then(
          (lookup) => {
            // Sem vitrine (404 do D10): o mesmo 404 neutro da locadora desconhecida, mesmo que a locadora ainda tenha
            // área do cliente (site não publicado).
            if (lookup.status === 'not-found')
              return rewrite(siteNotFoundRewrite().pathname)
            if (lookup.status !== 'site') return rewrite()
            if (lookup.state.mode === 'PAUSED') {
              // Páginas legais seguem no ar na pausa (onda 134, decisão 4): 200, noindex e sem cache.
              if (pausedSiteServes(host, decision.pathname))
                return rewrite(undefined, {
                  headers: PAUSED_LEGAL_PAGE_HEADERS,
                })
              // Nome que não é utilitário do Tailwind: o CSS do web lê esta pasta e geraria a regra (achado 141).
              const pausedSite = sitePausedRewrite(slug)
              return rewrite(pausedSite.pathname, {
                status: 503,
                headers: pausedSite.headers,
              })
            }
            if (!lookup.state.indexable)
              return rewrite(undefined, {
                headers: { 'X-Robots-Tag': 'noindex' },
              })
            return rewrite()
          },
          () => rewrite()
        )
      }
      case 'backend': {
        if (env.apiOrigin === null || env.edgeSecret === null) {
          // Sem backend ou sem segredo, o contexto de host não chegaria ao destino: não repassa.
          return respond(platformUnavailable(true))
        }
        headers.set(PLATFORM_EDGE_HEADER.auth, env.edgeSecret)
        headers.set(PLATFORM_EDGE_HEADER.hostKind, decision.edge.hostKind)
        headers.set(PLATFORM_EDGE_HEADER.origin, decision.edge.origin)
        if (decision.edge.tenantSlug !== null)
          headers.set(PLATFORM_EDGE_HEADER.tenantSlug, decision.edge.tenantSlug)
        const clientIp = request.headers.get('x-real-ip')
        if (clientIp) headers.set(PLATFORM_EDGE_HEADER.clientIp, clientIp)
        if (decision.stripSelectionCookie) {
          const cookie = withoutCookie(
            headers.get('cookie'),
            TENANT_COOKIE_NAME
          )
          if (cookie === '') headers.delete('cookie')
          else headers.set('cookie', cookie)
        }
        return NextResponse.rewrite(
          new URL(decision.pathname + decision.search, env.apiOrigin),
          {
            request: { headers },
          }
        )
      }
      case 'redirect':
        return NextResponse.redirect(decision.location, decision.status)
      case 'respond':
        return respond(decision)
    }
  }
}
