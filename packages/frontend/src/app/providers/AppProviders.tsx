'use client'
import { DeviceActionsProvider, type DeviceActions } from '../../shared/device'
import { RuntimeBootstrap } from './RuntimeBootstrap'
import type {SessionAdapter,SessionSnapshot} from '../../entities/sessao'
import type {TenantContext} from '../../entities/organizacao'
import {createHttpClient} from '../../shared/api'
import { IdentidadePublicaProvider, PublicTenantProvider, type IdentidadePublica } from '../../entities/organizacao'
import { HrefResolverProvider, InternalRoutePrefixProvider } from '../../shared/lib/navigation'
import type { ReactNode } from 'react'
import {
  NavigationProvider,
  ThemeProvider,
  type Navigate,
} from '@gb-locacoes/ui'
import { ApiClientProvider, type HttpClient } from '../../shared/api'

const defaultApiClient=createHttpClient()
export function AppProviders({
  children,
  apiClient=defaultApiClient,
  navigate,
  publicTenantSlug = null,
  publicTenantIdentity,
  deviceActions, auth,privateArea=false,awaitSession,initialSession,refreshKey,persistSelection,onTenantSelected,resolveHref,internalRoutePrefix=null,
}: {
  children: ReactNode
  apiClient?: HttpClient
  navigate?: Navigate
  publicTenantSlug?: string | null
  /**
   * Identidade pública da locadora (cartão) já lida pelo host; omitida, a vitrine a lê pelo slug (modo legado).
   */
  publicTenantIdentity?: IdentidadePublica | null
  deviceActions?: DeviceActions
  auth?:SessionAdapter
  /**
   * Rota atual é área privada. O conteúdo da área só aparece dentro de um `PrivateAreaGate` (ClientLayoutShell no web,
   * `screenLayout` do Stack no mobile); os filhos daqui (o navegador do host) nunca são trocados.
   */
  privateArea?:boolean
  /** Espera sessão e escopo do carrinho antes de renderizar a rota (padrão: renderiza já, inclusive no SSR). */
  awaitSession?:boolean
  /** Sessão lida pelo host no servidor; evita o getSession inicial no cliente. */
  initialSession?:SessionSnapshot
  refreshKey?:string
  persistSelection?:boolean
  onTenantSelected?:(selection:TenantContext)=>void
  resolveHref?:(href:string)=>string
  /** Modo host: prefixo interno `/{slug}` do rewrite, removido por `useVisiblePathname`. */
  internalRoutePrefix?:string | null
}) {
  const deviceContent = deviceActions ? (
    <DeviceActionsProvider value={deviceActions}>
      {children}
    </DeviceActionsProvider>
  ) : (
    children
  )
  const tenantContent = auth?<RuntimeBootstrap auth={auth} apiClient={apiClient} navigate={navigate} publicTenantSlug={publicTenantSlug} privateArea={privateArea} awaitSession={awaitSession} initialSession={initialSession} refreshKey={refreshKey} persistSelection={persistSelection} onTenantSelected={onTenantSelected}>{deviceContent}</RuntimeBootstrap>:deviceContent
  const content = (
    <ApiClientProvider client={apiClient}>
      <PublicTenantProvider value={publicTenantSlug}>
        {publicTenantIdentity === undefined ? tenantContent : (
          <IdentidadePublicaProvider value={publicTenantIdentity}>{tenantContent}</IdentidadePublicaProvider>
        )}
      </PublicTenantProvider>
    </ApiClientProvider>
  )
  return (
    <ThemeProvider scheme="light">
      <InternalRoutePrefixProvider prefix={internalRoutePrefix}>
        <HrefResolverProvider resolveHref={resolveHref}>
          {navigate ? (
            <NavigationProvider navigate={navigate} resolveHref={resolveHref}>{content}</NavigationProvider>
          ) : (
            content
          )}
        </HrefResolverProvider>
      </InternalRoutePrefixProvider>
    </ThemeProvider>
  )
}
