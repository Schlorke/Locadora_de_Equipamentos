import type { PrismaClient } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/contracts'

/** Validation for preference reads/writes, always scoped to the authenticated identity. */
export async function findActiveOrganizationMembership(
  database: Pick<PrismaClient, 'membership'>,
  userId: string,
  tenantId: string
): Promise<TenantContext | null> {
  const row = await database.membership.findFirst({
    where: {
      userId,
      tenantId,
      status: 'ACTIVE',
      organization: { status: 'ACTIVE' },
    },
    select: {
      id: true,
      role: true,
      organization: {
        select: { id: true, slug: true, name: true, status: true },
      },
    },
  })
  return row
    ? { membershipId: row.id, role: row.role, tenant: row.organization }
    : null
}

/** Own active memberships only; this read never selects a tenant on the user's behalf. */
export async function listActiveOrganizationMemberships(
  database: Pick<PrismaClient, 'membership'>,
  userId: string
) {
  const memberships = await database.membership.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      organization: { status: 'ACTIVE' },
    },
    select: {
      id: true,
      role: true,
      organization: {
        select: { id: true, slug: true, name: true, status: true },
      },
    },
    orderBy: { organization: { name: 'asc' } },
  })
  return memberships.map((membership) => ({
    membershipId: membership.id,
    role: membership.role,
    tenant: membership.organization,
  }))
}
