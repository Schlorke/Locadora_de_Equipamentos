import type { MembershipRole } from '@gb-locacoes/contracts'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { OrganizationAccess } from '@gb-locacoes/contracts/subscription'

export type TenantPrincipal = {
  userId: string
  tenantId: string
  membershipId: string
  role: MembershipRole
  /** Present only with subscription enforcement on; membership/RBAC remains authoritative. */
  access?: OrganizationAccess
  isOwner?: boolean
  actor?: 'owner' | 'staff' | 'client'
}

export type MembershipRecord = {
  id: string
  tenantId: string
  userId: string
  role: TenantPrincipal['role']
  status: string
  organization: { status: string }
}

export type TenantAccess =
  | { ok: true; principal: TenantPrincipal }
  | { ok: false; status: 400 | 401 | 403 | 409; error: string }

/**
 * Fonte de uma locadora candidata: `host` vem da borda validada (host de
 * locadora), `header` de `x-tenant-id` e `cookie` de `selected-tenant-id`.
 */
export type TenantCandidateSource = 'host' | 'header' | 'cookie'
export type TenantCandidate = {
  source: TenantCandidateSource
  tenantId: string
}

export async function resolvePrincipal(input: {
  userId: string | null
  /** Locadoras candidatas; nenhuma é escolhida por padrão. */
  candidates: readonly TenantCandidate[]
  findMembership(
    _tenantId: string,
    _userId: string
  ): Promise<MembershipRecord | null>
}): Promise<TenantAccess> {
  if (!input.userId)
    return { ok: false, status: 401, error: 'Authentication required' }
  // Mais de um id distinto (host, header ou cookie) nunca é desempatado.
  if (new Set(input.candidates.map((c) => c.tenantId)).size > 1) {
    return { ok: false, status: 400, error: 'Conflicting tenant selection' }
  }
  const tenantId = input.candidates[0]?.tenantId ?? null
  if (!tenantId)
    return { ok: false, status: 409, error: 'Select an organization' }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(tenantId))
    return { ok: false, status: 400, error: 'Invalid tenant selection' }
  const membership = await input.findMembership(tenantId, input.userId)
  if (
    !membership ||
    membership.tenantId !== tenantId ||
    membership.userId !== input.userId ||
    membership.status !== 'ACTIVE' ||
    membership.organization.status !== 'ACTIVE'
  ) {
    return { ok: false, status: 403, error: 'Organization access denied' }
  }
  return {
    ok: true,
    principal: {
      userId: input.userId,
      tenantId,
      membershipId: membership.id,
      role: membership.role,
    },
  }
}

export async function withTenantTransaction<T>(
  prisma: PrismaClient,
  context: { tenantId: string },
  operation: (_transaction: Prisma.TransactionClient) => Promise<T>,
  options: {
    isolationLevel?: Prisma.TransactionIsolationLevel
    timeout?: number
    maxWait?: number
  } = {}
): Promise<T> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(context.tenantId))
    throw new Error('Explicit tenant context is required')
  return prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`SELECT set_config('app.tenant_id', ${context.tenantId}, true)`
      return operation(transaction)
    },
    { timeout: 15_000, maxWait: 15_000, ...options }
  )
}
