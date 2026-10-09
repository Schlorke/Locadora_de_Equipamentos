/**
 * Vitrine em pausa no proxy (S13). As páginas não escolhem o status HTTP; só o proxy entrega a página de pausa com 503
 * de verdade. O modo vem do backend (`../server/site-state`); aqui só a escolha pura de quais páginas ele alcança e
 * do rewrite.
 */
import { SITE_PAUSED_HEADERS } from '@gb-locacoes/contracts/subscription'
import { STOREFRONT_PAUSE_PUBLIC_PATHS } from '@gb-locacoes/contracts/storefront-legal'
import type { HostClass } from '@gb-locacoes/contracts/platform'
import { SITE_PAUSED_PAGE } from '../server/site-state'
import { HOST_OWNED_PUBLIC_FILES, TENANT_ACCOUNT_PATHS, matchesAny } from './route-table'

/**
 * Locadora da página da vitrine sujeita ao modo do site: host de locadora, fora da entrada e da área do cliente
 * (que continuam com o site em pausa) e fora de robots.txt, sitemap.xml e manifest.json (cada um decide por si).
 * `rewritten` é o caminho interno já reescrito pelo proxy (`/{slug}{caminho}`).
 */
export function storefrontSlug(host: HostClass, rewritten: string): string | null {
  if (host.kind !== 'tenant') return null
  const prefix = '/' + host.slug
  if (rewritten !== prefix && !rewritten.startsWith(prefix + '/')) return null
  const visible = rewritten.slice(prefix.length) || '/'
  if (matchesAny(visible, TENANT_ACCOUNT_PATHS)) return null
  if (HOST_OWNED_PUBLIC_FILES.some((file) => visible === '/' + file)) return null
  return host.slug
}

/**
 * Página legal da vitrine que continua no ar durante a pausa (onda 134; decisão do dono de 2026-10-06, item 4): Termos,
 * Privacidade, Devolução e Cookies (`STOREFRONT_PAUSE_PUBLIC_PATHS`, a fonte única). O resto da vitrine segue na
 * página de pausa com 503. Nenhuma leitura nova: decide pelo caminho, depois do modo que o proxy já leu.
 */
export function pausedSiteServes(host: HostClass, rewritten: string): boolean {
  if (host.kind !== 'tenant') return false
  const prefix = '/' + host.slug
  if (!rewritten.startsWith(prefix + '/')) return false
  const visible = rewritten.slice(prefix.length)
  return (STOREFRONT_PAUSE_PUBLIC_PATHS as readonly string[]).includes(visible)
}

/** Página legal em pausa: HTTP 200, fora dos buscadores e sem cache (a pausa pode acabar a qualquer momento). */
export const PAUSED_LEGAL_PAGE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'X-Robots-Tag': 'noindex',
  'Cache-Control': 'no-store',
})

/** Rewrite da vitrine em pausa: a página de pausa da locadora com 503, Retry-After, sem cache e noindex. */
export function sitePausedRewrite(slug: string): {
  readonly pathname: string
  readonly headers: Readonly<Record<string, string>>
} {
  return { pathname: '/' + slug + SITE_PAUSED_PAGE, headers: SITE_PAUSED_HEADERS }
}

/**
 * Segmento interno que nunca é slug de locadora (`isTenantSlug` recusa): o layout `[locadora]` dá o `notFound()` neutro
 * antes de qualquer leitura, como para uma locadora desconhecida.
 */
export const SITE_NOT_FOUND_SEGMENT = '_'

/**
 * Rewrite da página da vitrine sem vitrine (o cartão respondeu o 404 do D10: locadora desconhecida, bloqueada ou com o
 * site desligado): sempre o mesmo caminho interno, então a resposta é a mesma, byte a byte, para todas. A vitrine
 * desligada de uma locadora que ainda tem área do cliente (não publicada) não passa pelo layout que a atende; nem as
 * páginas que esperam a sessão para montar (/orcamento) escapam do 404 real.
 */
export function siteNotFoundRewrite(): { readonly pathname: string } {
  return { pathname: '/' + SITE_NOT_FOUND_SEGMENT }
}
