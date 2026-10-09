import 'server-only'
import type { Metadata } from 'next'
import { isTenantSlug } from '@gb-locacoes/contracts/platform'
import { seoDaVitrine, type PaginaDaVitrine } from '@gb-locacoes/frontend/app'
import { getPublicSettings } from '../../../../host/server/public-api'
import { getLojaDaVitrine } from './loja'

/**
 * Metadados de uma página da vitrine (onda 135, A4; E12 do plano de aposentadoria da raiz): título, descrição,
 * canonical e Open Graph da própria locadora, montados por `seoDaVitrine` (packages/frontend) com o cartão público e as
 * configurações dela. Mesmas leituras do layout e da página, deduplicadas na requisição. Sem cartão (slug inválido ou
 * vitrine desligada, o 404 do layout), nada: o título neutro do layout raiz fica. A indexação (`robots`) é do layout
 * `[locadora]`, que já tira o site não indexável dos buscadores; aqui nada a reabre.
 */
export async function metadataDaVitrine(
  slug: string,
  pagina: PaginaDaVitrine
): Promise<Metadata> {
  if (!isTenantSlug(slug)) return {}
  const [loja, configuracoes] = await Promise.all([
    getLojaDaVitrine(slug),
    getPublicSettings(slug),
  ])
  if (!loja) return {}
  const seo = seoDaVitrine(pagina, loja, configuracoes)
  const imagens = seo.imageUrl
    ? [{ url: seo.imageUrl, alt: seo.imageAlt }]
    : undefined
  return {
    title: { absolute: seo.title },
    description: seo.description,
    ...(seo.canonicalUrl
      ? { alternates: { canonical: seo.canonicalUrl } }
      : {}),
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      title: seo.title,
      description: seo.description,
      siteName: seo.siteName,
      ...(seo.canonicalUrl ? { url: seo.canonicalUrl } : {}),
      ...(imagens ? { images: imagens } : {}),
    },
    twitter: {
      card: 'summary',
      title: seo.title,
      description: seo.description,
      ...(imagens ? { images: imagens } : {}),
    },
  }
}
