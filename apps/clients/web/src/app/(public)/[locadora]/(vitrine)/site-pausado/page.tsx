import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isTenantSlug } from '@gb-locacoes/contracts/platform'
import { SitePausadoPage } from '@gb-locacoes/frontend/pages/site-pausado'
import { tenantAccountEnabled } from '../../../../../host/auth/mode'
import { getPublicSettings, getPublicSite } from '../../../../../host/server/public-api'
import { documentosPublicados } from '../pausa'

interface Props {
  params: Promise<{ locadora: string }>
}

/**
 * Vitrine em pausa (S13). O proxy reescreve as páginas da vitrine para cá com HTTP 503, Retry-After e noindex quando o
 * cartão público diz PAUSED; com o site no ar (ou desligado), este caminho é o 404 neutro. O contato vem das
 * configurações públicas da locadora; a área do cliente continua (fora do modo legacy). A moldura é a neutra da
 * página (marca da locadora e rodapé mínimo): o TenantSiteProviders não monta a da vitrine neste segmento.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locadora } = await params
  const site = isTenantSlug(locadora) ? await getPublicSite(locadora) : null
  return {
    title: site?.mode === 'PAUSED' ? `${site.name} | Temporariamente indisponível` : undefined,
    robots: { index: false, follow: false },
  }
}

export default async function Page({ params }: Props) {
  const { locadora } = await params
  if (!isTenantSlug(locadora)) notFound()
  const site = await getPublicSite(locadora)
  if (site?.mode !== 'PAUSED') notFound()
  const settings = await getPublicSettings(locadora)
  return (
    <SitePausadoPage
      nome={site.name}
      cidade={site.city}
      uf={site.state}
      logoUrl={site.logoUrl}
      contato={{
        telefone: settings?.companyPhone,
        whatsapp: settings?.whatsappNumber,
        email: settings?.contactEmail,
      }}
      areaDoClienteHref={tenantAccountEnabled() ? '/area-cliente' : null}
      documentos={documentosPublicados(settings)}
    />
  )
}
