import 'server-only'
import {
  canonicalOrigin,
  resolveWebPlatformEnv,
} from '@gb-locacoes/contracts/platform'
import { getPublicSite } from '../../../../host/server/public-api'

/** A locadora dona da vitrine para SEO e JSON-LD: o cartão público dela e a origem canônica do site dela. */
export interface LojaDaVitrine {
  readonly name: string
  readonly city: string | null
  readonly state: string | null
  readonly logoUrl: string | null
  /** `https://{slug}.<raiz>`; `null` quando o ambiente não define a raiz (as URLs saem relativas). */
  readonly origin: string | null
}

/**
 * Identidade da vitrine nas páginas (achado 143; T12 e Lote 5 da ADR adr-tenant-hosts): nome, cidade, UF e logo do
 * cartão da própria locadora e a origem canônica do host dela, nunca um domínio ou nome fixo. Sem cartão: `null`.
 */
export async function getLojaDaVitrine(
  slug: string
): Promise<LojaDaVitrine | null> {
  const site = await getPublicSite(slug)
  if (!site) return null
  let origin: string | null
  try {
    origin = canonicalOrigin(resolveWebPlatformEnv(process.env), {
      slug: site.slug,
    })
  } catch {
    origin = null
  }
  return {
    name: site.name,
    city: site.city,
    state: site.state,
    logoUrl: site.logoUrl,
    origin,
  }
}
