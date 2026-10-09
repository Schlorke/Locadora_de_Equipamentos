import type { Prisma } from '@prisma/client'
import {
  createPublicTenantResolver,
  createTenantPrincipalResolver,
  publicCacheHeaders as sharedPublicCacheHeaders,
  withTenantTransaction as runTenantTransaction,
  type MutationRequest,
  type PlatformEdgeContext,
  type PublicTenant,
  type PublicRequestTenant,
  type PublicRequestTenantOptions,
  type TenantPrincipalResolution,
  type TenantPrincipal,
} from '@gb-locacoes/backend/identity'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/application-session'

export type { PlatformEdgeContext, TenantPrincipal }

const privatePrincipal = createTenantPrincipalResolver({
  getSession: getServerSession,
  getDatabase: () => prisma,
  resolvePublicTenant,
})

/**
 * Principal da locadora. Candidatas: a locadora do host (borda validada de um
 * host de locadora), `x-tenant-id` e o cookie de seleção. Mais de um id
 * distinto responde 400; a membership é validada a cada requisição.
 *
 * Ponto central de autorização por cookie: antes da sessão, toda mutação de
 * navegador vinda de outra origem responde 403 (`rejectCrossOriginMutation`),
 * para que nenhuma rota que passe por aqui (ou por `requireTenantPermission` e
 * pelos middlewares de `requireAdmin`) consiga esquecer o guard. Quem só
 * enxerga os cabeçalhos (`next/headers`) passa `method: null` e `url: null`.
 */
export async function resolveTenantPrincipal(
  request: MutationRequest
): Promise<TenantPrincipalResolution> {
  return privatePrincipal(request)
}

export function withTenantTransaction<T>(
  context: { tenantId: string },
  operation: (_transaction: Prisma.TransactionClient) => Promise<T>,
  options: {
    isolationLevel?: Prisma.TransactionIsolationLevel
    timeout?: number
    maxWait?: number
  } = {}
): Promise<T> {
  return runTenantTransaction(prisma, context, operation, options)
}

/** Composição legada: a regra pública é compartilhada com o serviço HTTP. */
// Fatos do modo do site (S13): o tipo do resolvedor exige os mesmos campos nos dois hosts.
const publicTenants = createPublicTenantResolver((slug) =>
  prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      access: true,
      sitePublishedAt: true,
      siteIndexable: true,
    },
  })
)
export function resolvePublicTenant(
  slug: string
): Promise<PublicTenant | null> {
  return publicTenants.resolvePublicTenant(slug)
}
export function resolvePublicRequestTenant(
  request: Request,
  options: PublicRequestTenantOptions = {}
): Promise<PublicRequestTenant> {
  return publicTenants.resolvePublicRequestTenant(request, options)
}
export function publicCacheHeaders(
  edge: PlatformEdgeContext | null,
  fallback: string
): Record<string, string> {
  return sharedPublicCacheHeaders(edge, fallback)
}
export { publicTenantNotFound } from '@gb-locacoes/backend/identity'
export function resolveCurrentOrganizationTenant(
  request: Request
): Promise<PublicRequestTenant> {
  return publicTenants.resolveCurrentOrganizationTenant(request)
}
