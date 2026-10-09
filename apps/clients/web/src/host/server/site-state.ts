/**
 * Modo do site público da locadora (S13; ADR docs/architecture/adr-saas-subscription.md, B.5 e B.10). A regra mora
 * no backend: o cartão público (`GET /api/public/tenants/{slug}`) responde 200 em LIVE e PAUSED, com o modo nos
 * cabeçalhos, e o mesmo 404 neutro em OFF (D10). No escopo da área do cliente (`?scope=client-area`), o cartão
 * responde enquanto a área existe, inclusive com o site desligado (`OFF`). Aqui só se lê o que o backend decidiu, sem
 * regra própria. Usado pelo gateway das páginas e pelo proxy (que precisa do modo para responder 503 e 404 de verdade).
 */
import {
  PublicSiteModeSchema,
  SITE_INDEXABLE_HEADER,
  SITE_MODE_HEADER,
} from '@gb-locacoes/contracts/subscription'

export interface SiteState {
  readonly mode: 'LIVE' | 'PAUSED'
  readonly indexable: boolean
}

/** Modo do site no cartão do escopo da área do cliente, que também responde com o site desligado. */
export interface TenantSiteState {
  readonly mode: 'LIVE' | 'PAUSED' | 'OFF'
  readonly indexable: boolean
}

/** Caminho visível da página de pausa (`[locadora]/site-pausado`), destino do rewrite com 503. */
export const SITE_PAUSED_PAGE = '/site-pausado'

/**
 * Modo lido dos cabeçalhos do cartão no escopo da área do cliente. Sem o cabeçalho (backend anterior ao S13),
 * conserva o comportamento anterior: no ar e indexável. Valor fora do contrato é falha do backend.
 */
export function readTenantSiteState(response: Pick<Response, 'headers'>): TenantSiteState {
  const raw = response.headers.get(SITE_MODE_HEADER)
  if (raw === null) return { mode: 'LIVE', indexable: true }
  const mode = PublicSiteModeSchema.safeParse(raw)
  if (!mode.success) throw new Error('Modo do site fora do contrato.')
  return {
    mode: mode.data,
    indexable: mode.data === 'LIVE' && response.headers.get(SITE_INDEXABLE_HEADER) === 'true',
  }
}

/** Modo lido dos cabeçalhos do cartão da vitrine: OFF num cartão que respondeu é falha do backend. */
export function readSiteState(response: Pick<Response, 'headers'>): SiteState {
  const state = readTenantSiteState(response)
  if (state.mode === 'OFF') throw new Error('Modo do site fora do contrato.')
  return { mode: state.mode, indexable: state.indexable }
}

/**
 * Leitura do modo da vitrine no backend: o modo (LIVE ou PAUSED), o 404 do D10 (locadora desconhecida, bloqueada ou
 * com o site desligado: a vitrine não existe) ou a leitura que falhou (sem resposta, prazo, 5xx ou fora do contrato).
 */
export type SiteLookup =
  | { readonly status: 'site'; readonly state: SiteState }
  | { readonly status: 'not-found' }
  | { readonly status: 'unavailable' }

export type SiteStateReader = (apiOrigin: string, slug: string) => Promise<SiteLookup>

export function createSiteStateReader(
  fetcher: (input: string, init: RequestInit) => Promise<Response> = (input, init) => fetch(input, init),
  timeoutMs = 3000
): SiteStateReader {
  return async (apiOrigin, slug) => {
    try {
      const response = await fetcher(apiOrigin + '/api/public/tenants/' + encodeURIComponent(slug), {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (response.status === 404) return { status: 'not-found' }
      if (response.status !== 200) return { status: 'unavailable' }
      return { status: 'site', state: readSiteState(response) }
    } catch {
      return { status: 'unavailable' }
    }
  }
}
