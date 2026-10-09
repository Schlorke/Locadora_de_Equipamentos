import type { PrismaClient } from '@prisma/client'
import { createSubscriptionRequestAccess } from '../entitlements/request-access'
import { readPlatformEdgeContext } from './platform-edge'
import { publicTenantNotFound, type PublicTenant } from './public-tenant'
import {
  rejectCrossOriginMutation,
  rejectExplicitCrossOrigin,
  type MutationRequest,
} from './same-origin-mutation'
import { selectedTenantCookie } from './tenant-preference'
import {
  resolvePrincipal,
  withTenantTransaction,
  type TenantCandidate,
  type TenantPrincipal,
} from './tenant-principal'

export type TenantPrincipalResolution =
  | { ok: true; principal: TenantPrincipal }
  | { ok: false; response: Response; error?: string }

/** Request policy shared by the legacy and service hosts; dependencies stay lazy. */
export function createTenantPrincipalResolver(dependencies: {
  getSession(): Promise<{ user?: { id?: string | null } } | null>
  getDatabase(): PrismaClient
  resolvePublicTenant(_slug: string): Promise<PublicTenant | null>
}) {
  return async function resolveTenantPrincipal(
    request: MutationRequest
  ): Promise<TenantPrincipalResolution> {
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin)
      return { ok: false, response: crossOrigin, error: 'Origem não permitida' }
    const session = await dependencies.getSession()
    let cookieTenant: string | null
    try {
      cookieTenant = selectedTenantCookie(request)
    } catch {
      return {
        ok: false,
        error: 'Invalid tenant selection',
        response: Response.json(
          { error: 'Invalid tenant selection' },
          { status: 400 }
        ),
      }
    }
    const candidates: TenantCandidate[] = []
    const edge = readPlatformEdgeContext(request)
    if (edge?.hostKind === 'tenant') {
      const hostTenant = await dependencies.resolvePublicTenant(edge.tenantSlug)
      if (!hostTenant)
        return {
          ok: false,
          response: publicTenantNotFound(),
          error: 'Locadora não encontrada',
        }
      candidates.push({ source: 'host', tenantId: hostTenant.tenantId })
    }
    const headerTenant = request.headers.get('x-tenant-id')
    if (headerTenant !== null)
      candidates.push({ source: 'header', tenantId: headerTenant })
    if (cookieTenant !== null)
      candidates.push({ source: 'cookie', tenantId: cookieTenant })
    const result = await resolvePrincipal({
      userId: session?.user?.id || null,
      candidates,
      findMembership: (tenantId, userId) =>
        withTenantTransaction(dependencies.getDatabase(), { tenantId }, (tx) =>
          tx.membership.findUnique({
            where: { tenantId_userId: { tenantId, userId } },
            include: { organization: { select: { status: true } } },
          })
        ),
    })
    if (!result.ok)
      return {
        ok: false,
        error: result.error,
        response: Response.json(
          { error: result.error },
          { status: result.status }
        ),
      }
    // Explicit foreign Origin on reads too (wave 132, finding 144): after the membership (the role), before the
    // subscription admission and any data; 401/400/404/409/403 above keep their envelopes, no Origin keeps working.
    const explicitOrigin = rejectExplicitCrossOrigin(request)
    if (explicitOrigin)
      return {
        ok: false,
        response: explicitOrigin,
        error: 'Origem não permitida',
      }
    const decision = await createSubscriptionRequestAccess({
      getDatabase: dependencies.getDatabase,
    })(request, result.principal)
    if (decision.response)
      return {
        ok: false,
        response: decision.response,
        error: (await decision.response.clone().json()).error,
      }
    return { ok: true, principal: decision.principal }
  }
}
