import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import Script from 'next/script'
import { notFound } from 'next/navigation'
import { isTenantSlug } from '@gb-locacoes/contracts/platform'
import { medicaoDaLocadora, tagDoGoogle } from '@gb-locacoes/frontend/app'
import {
  getPublicSettings,
  getTenantSite,
} from '../../../host/server/public-api'
import { TenantSiteProviders } from '../../../host/providers/TenantSiteProviders'

/**
 * Medição e verificação da própria locadora (onda 135, A11; decisão do dono D4): os identificadores que ela gravou no
 * painel (`siteContent`), já validados pelo contrato. Sem configuração ou com o backend fora: nada.
 */
async function medicaoDoSite(slug: string) {
  return medicaoDaLocadora((await getPublicSettings(slug))?.siteContent)
}

/**
 * Host de uma locadora: a vitrine (grupo `(vitrine)`) e a área do cliente (grupos `(auth)` e `(account)`). Alcançável
 * só pelo rewrite do proxy num host de locadora (`{slug}.<raiz>` → `/{slug}...`).
 *
 * A locadora vem apenas do segmento (que o proxy tirou do Host): nenhum `headers()` ou `cookies()` nesta árvore
 * (D4). O cartão é o do escopo da área do cliente (S13; B.5, linha "Área do cliente final"), que continua com o site
 * em pausa ou desligado por falta de publicação. Slug inválido ou reservado, locadora inexistente, com bloqueio
 * administrativo ou sem área do cliente (SETUP ou ARCHIVED com a fiscalização `on`): o mesmo `notFound()` neutro (D10),
 * resolvido pelo app/not-found.tsx antes de qualquer conteúdo da locadora. A vitrine desligada é o 404 do layout
 * `(vitrine)` (e do proxy); o site em pausa ou ainda não indexável: `noindex` em toda a árvore; a página de pausa com
 * 503 vem do proxy.
 *
 * Onda 135 (A11): as metas de verificação do Google Search Console e do domínio no Facebook/Meta, quando a locadora as
 * informou, e a tag do Google (GA4 e Google Ads) com os IDs dela. Só identificadores validados, num modelo fixo; a CSP
 * do host de locadora (next.config.mjs) só admite as origens do Google na lista.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locadora: string }>
}): Promise<Metadata> {
  const { locadora } = await params
  if (!isTenantSlug(locadora)) return {}
  const [site, medicao] = await Promise.all([
    getTenantSite(locadora),
    medicaoDoSite(locadora),
  ])
  if (!site) return {}
  return {
    ...(!site.indexable ? { robots: { index: false, follow: false } } : {}),
    ...(medicao.googleSiteVerification
      ? { verification: { google: medicao.googleSiteVerification } }
      : {}),
    ...(medicao.facebookDomainVerification
      ? {
          other: {
            'facebook-domain-verification': medicao.facebookDomainVerification,
          },
        }
      : {}),
  }
}

export default async function TenantSiteLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locadora: string }>
}) {
  const { locadora } = await params
  if (!isTenantSlug(locadora)) notFound()
  const [site, medicao] = await Promise.all([
    getTenantSite(locadora),
    medicaoDoSite(locadora),
  ])
  if (!site) notFound()
  // Identidade da própria locadora (cartão): a vitrine nunca completa nome, cidade ou logo com dado de outra (T12).
  const identity = { name: site.name, city: site.city, state: site.state, logoUrl: site.logoUrl }
  const providers = (
    <TenantSiteProviders
      tenantSlug={site.slug}
      identity={identity}
      siteMode={site.mode}
    >
      {children}
    </TenantSiteProviders>
  )
  // Tag do Google da locadora (onda 135, A11): só com o GA4 ou o Google Ads dela; sem nenhum, nada é injetado.
  const tag = tagDoGoogle(medicao)
  if (!tag) return providers
  return (
    <>
      {providers}
      <Script id="tag-do-google" src={tag.src} strategy="afterInteractive" />
      <Script id="tag-do-google-config" strategy="afterInteractive">
        {tag.configuracao}
      </Script>
    </>
  )
}
