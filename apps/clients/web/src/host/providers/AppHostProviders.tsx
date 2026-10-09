'use client'
import { Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  AppProviders,
  ClientLayoutShell,
  usePublicTenantRouting,
  type ClientLayoutShellProps,
  type PublicTenantStorage,
} from '@gb-locacoes/frontend/app'
import { hostAuth } from '../auth/client'
import { hostApiClient, useHostNavigate } from './host-navigation'

const ScrollRevealInit = dynamic(() => import('@gb-locacoes/frontend/app').then((module) => module.ScrollRevealInit), {
  ssr: false,
})

// O host `app` não tem locadora pública: nada é lembrado nem aplicado na URL. A locadora do painel é a seleção
// explícita validada por membership (TenantSelector e x-tenant-id).
const noPublicTenantStorage: PublicTenantStorage = { getItem: () => null, setItem: () => undefined }
const keepUrl = () => undefined

/**
 * Providers do host `app` (painel, fluxos de conta da equipe e laboratório). `chrome` é a moldura que o layout do
 * grupo escolhe: `platform` nos fluxos de conta (casca da plataforma, sem a vitrine); o padrão é o de antes.
 */
export function AppHostProviders({
  children,
  chrome,
}: {
  children: ReactNode
  chrome?: ClientLayoutShellProps['chrome']
}) {
  const pathname = usePathname() ?? '/'
  const routing = usePublicTenantRouting({
    pathname,
    explicitSlug: null,
    storage: noPublicTenantStorage,
    applySlug: keepUrl,
  })
  const navigate = useHostNavigate(routing.resolveHref)
  return (
    <AppProviders apiClient={hostApiClient} auth={hostAuth} navigate={navigate} refreshKey={pathname} {...routing}>
      <ClientLayoutShell chrome={chrome} publicExtras={<ScrollRevealInit />}>
        {/* Mesmo limite de Suspense do layout raiz anterior: páginas pré-renderizadas do painel leem a query. */}
        <Suspense fallback={null}>{children}</Suspense>
      </ClientLayoutShell>
    </AppProviders>
  )
}
