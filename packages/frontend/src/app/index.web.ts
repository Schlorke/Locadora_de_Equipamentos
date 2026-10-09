export { AppProviders } from './providers/AppProviders'
export { PrivateAreaGate } from './providers/RuntimeBootstrap'
export { ClientLayoutShell } from './providers/ClientLayoutShell.web'
export { AdminLayoutShell } from './providers/AdminLayoutShell.web'
export { AccountLayoutShell } from './providers/AccountLayoutShell.web'
export type { ClientLayoutShellProps } from './providers/ClientLayoutShell.web'
export { SessionProviderWrapper } from './providers/SessionProviderWrapper.web'
export { usePublicTenantRouting } from './providers/public-tenant-routing'
export type {
  PublicTenantRouting,
  PublicTenantRoutingOptions,
  LegacyPublicTenantRoutingOptions,
  HostPublicTenantRoutingOptions,
  PublicTenantStorage,
} from './providers/public-tenant-routing'
export { sessionTenantStorage } from './providers/public-tenant-storage.web'
export { SEOSchemas, defaultFAQItems } from '../widgets/seo-schemas'

export { createHttpClient } from '../shared/api/http-client'
export type { HttpClient } from '../shared/api/http-client'

export { TenantProvider, useTenantContext } from '../entities/organizacao'
export type {
  TenantContext,
  TenantSummary,
  MembershipRole,
} from '../entities/organizacao'

export type { DeviceActions, PickedTextFile } from '../shared/device'

export { default as ScrollRevealInit } from './providers/ScrollRevealInit.web'

export { withPublicTenant } from '../entities/organizacao'
// Onda 135 (A4 e A11): SEO por página e medição/verificação da vitrine da locadora, montados pelo host web.
export {
  medicaoDaLocadora,
  seoDaVitrine,
  tagDoGoogle,
} from '../entities/configuracao'
export type { PaginaDaVitrine } from '../entities/configuracao'
export type { SessionAdapter, SessionSnapshot } from '../entities/sessao'
