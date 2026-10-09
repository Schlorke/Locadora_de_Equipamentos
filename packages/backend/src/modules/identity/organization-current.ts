import type { PrismaClient } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/contracts'
import { withTenantTransaction } from './tenant-principal'

type CurrentOrganizationRead = {
  status: 200 | 403 | 404
  body: { membership: TenantContext } | { error: string; code?: string }
}

/** Only the host tenant/current identity; no preference, global role or listing fallback. */
export async function readCurrentOrganizationMembership(
  database: PrismaClient,
  tenantId: string,
  userId: string
): Promise<CurrentOrganizationRead> {
  const membership = await withTenantTransaction(database, { tenantId }, (tx) =>
    tx.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: {
        id: true,
        role: true,
        status: true,
        tenantId: true,
        userId: true,
        organization: {
          select: { id: true, slug: true, name: true, status: true },
        },
      },
    })
  )
  if (
    !membership ||
    membership.tenantId !== tenantId ||
    membership.userId !== userId
  )
    return {
      status: 404,
      body: { error: 'Sem vínculo com esta locadora', code: 'NO_MEMBERSHIP' },
    }
  if (
    membership.status !== 'ACTIVE' ||
    membership.organization.status !== 'ACTIVE'
  )
    return { status: 403, body: { error: 'Organization access denied' } }
  return {
    status: 200,
    body: {
      membership: {
        membershipId: membership.id,
        role: membership.role,
        tenant: {
          id: membership.organization.id,
          slug: membership.organization.slug,
          name: membership.organization.name,
          status: membership.organization.status,
        },
      },
    },
  }
}
