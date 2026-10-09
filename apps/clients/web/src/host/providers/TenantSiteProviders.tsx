'use client'
import type { ReactNode } from 'react'
import { usePathname, useSelectedLayoutSegments } from 'next/navigation'
import dynamic from 'next/dynamic'
import { AppProviders, ClientLayoutShell, usePublicTenantRouting } from '@gb-locacoes/frontend/app'
import { hostAuth } from '../auth/client'
import { hostApiClient, useHostNavigate, visiblePathname } from './host-navigation'

const ScrollRevealInit = dynamic(() => import('@gb-locacoes/frontend/app').then((module) => module.ScrollRevealInit), {
  ssr: false,
})

/** Segmento da página da vitrine em pausa (S13): ela traz a própria moldura neutra. */
const PAUSED_PAGE_SEGMENT = 'site-pausado'

/**
 * Páginas legais que continuam no ar na pausa (onda 134; decisão do dono de 2026-10-06, item 4): em pausa, cada uma
 * traz a moldura neutra da locadora (prop `moldura` da página), sem cabeçalho, carrinho, busca nem WhatsApp da vitrine.
 */
const PAUSED_LEGAL_SEGMENTS: readonly string[] = [
  'termos',
  'privacidade',
  'politica-devolucao',
  'cookies',
]

/** Identidade pública da locadora (cartão lido pelo layout no servidor). */
export interface TenantSiteIdentity {
  readonly name: string
  readonly city: string | null
  readonly state: string | null
  readonly logoUrl: string | null
}

/**
 * Providers da vitrine e da área do cliente num host de locadora (`{slug}.<raiz>`).
 *
 * A locadora vem do segmento `[locadora]`, que o proxy preencheu a partir do Host: modo host do roteamento público
 * (slug fixo, `resolveHref` identidade, sem armazenamento e sem `?tenantSlug=`). A composição do shell é a mesma
 * do host anterior, inclusive o `ScrollRevealInit` que sincroniza o carrossel 3D. A identidade (nome, cidade, UF e
 * logo) é a do cartão da própria locadora, nunca um padrão (T12).
 *
 * Moldura pela rota renderizada (o segmento abaixo do layout, que segue o rewrite do proxy, e não o caminho visível):
 * a página da pausa não recebe cabeçalho, rodapé nem WhatsApp da vitrine (achado 142).
 */
export function TenantSiteProviders({
  tenantSlug,
  identity,
  siteMode = 'LIVE',
  children,
}: {
  tenantSlug: string
  identity: TenantSiteIdentity
  /** Modo do site (cartão lido pelo layout): na pausa, as páginas legais ficam sem a moldura da vitrine. */
  siteMode?: 'LIVE' | 'PAUSED' | 'OFF'
  children: ReactNode
}) {
  const pathname = usePathname() ?? '/'
  const segments = useSelectedLayoutSegments()
  const routing = usePublicTenantRouting({ mode: 'host', pathname, tenantSlug })
  const navigate = useHostNavigate(routing.resolveHref)
  const pausedLegalPage =
    siteMode === 'PAUSED' &&
    segments.some((segment) => PAUSED_LEGAL_SEGMENTS.includes(segment))
  const chrome =
    segments.includes(PAUSED_PAGE_SEGMENT) || pausedLegalPage
      ? 'none'
      : 'storefront'
  return (
    <AppProviders
      apiClient={hostApiClient}
      auth={hostAuth}
      navigate={navigate}
      refreshKey={visiblePathname(pathname, routing.internalRoutePrefix)}
      publicTenantIdentity={{
        nome: identity.name,
        cidade: identity.city,
        uf: identity.state,
        logoUrl: identity.logoUrl,
      }}
      {...routing}
    >
      <ClientLayoutShell chrome={chrome} publicExtras={<ScrollRevealInit />}>
        {children}
      </ClientLayoutShell>
    </AppProviders>
  )
}
