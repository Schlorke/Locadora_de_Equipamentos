import { SitePublicationResponseSchema } from '@gb-locacoes/contracts/onboarding'
import type { TenantPrincipal } from '../identity/index'
import type { PlatformScope } from '../platform-scope/index'
import {
  lockTenantRentalMutations,
  type TenantTransactionRunner,
} from '../rentals/index'

export class SitePublicationError extends Error {
  constructor(
    readonly status: 402 | 403 | 409,
    readonly code:
      | 'OWNER_REQUIRED'
      | 'EMAIL_NOT_VERIFIED'
      | 'SUBSCRIPTION_RESTRICTED'
      | 'TENANT_ARCHIVED'
      | 'FIRST_EQUIPMENT_REQUIRED'
  ) {
    super(code)
  }
}

/** Platform writes lifecycle state; tenant scope supplies only the equipment count. */
export function createSitePublication(ports: {
  transaction: PlatformScope['withProvisioningTransaction']
  withTenantTransaction: TenantTransactionRunner
  now?: () => Date
}) {
  return (principal: TenantPrincipal) =>
    ports.transaction(principal.tenantId, async (tx) => {
      // Catalog writes take this lock first. Hold it until the publication commits.
      await lockTenantRentalMutations(tx, principal.tenantId)
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${principal.tenantId} FOR UPDATE`
      const membership = await tx.membership.findFirst({
        where: {
          id: principal.membershipId,
          tenantId: principal.tenantId,
          userId: principal.userId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        select: {
          organization: {
            select: {
              status: true,
              access: true,
              ownerUserId: true,
              sitePublishedAt: true,
            },
          },
        },
      })
      const org = membership?.organization
      if (
        principal.role !== 'ADMIN' ||
        org?.status !== 'ACTIVE' ||
        org.ownerUserId !== principal.userId
      )
        throw new SitePublicationError(403, 'OWNER_REQUIRED')
      if (org.access === 'ARCHIVED')
        throw new SitePublicationError(403, 'TENANT_ARCHIVED')
      if (org.access !== 'FULL')
        throw new SitePublicationError(402, 'SUBSCRIPTION_RESTRICTED')
      const contact = (
        await tx.$queryRaw<{ authEmailVerified: boolean }[]>`
      SELECT "authEmailVerified" FROM platform_user_contacts WHERE id=${principal.userId}
    `
      )[0]
      if (!contact?.authEmailVerified)
        throw new SitePublicationError(403, 'EMAIL_NOT_VERIFIED')
      if (org.sitePublishedAt)
        return SitePublicationResponseSchema.parse({
          published: true,
          publishedAt: org.sitePublishedAt.toISOString(),
        })
      const equipments = await ports.withTenantTransaction(
        { tenantId: principal.tenantId },
        async (business) => {
          await business.$executeRaw`SET TRANSACTION READ ONLY`
          return business.equipment.count({
            where: { tenantId: principal.tenantId },
          })
        }
      )
      if (equipments < 1)
        throw new SitePublicationError(409, 'FIRST_EQUIPMENT_REQUIRED')
      const now = (ports.now ?? (() => new Date()))()
      await tx.organization.update({
        where: { id: principal.tenantId },
        data: { sitePublishedAt: now },
      })
      await tx.platformAuditLog.create({
        data: {
          actorKind: 'OWNER',
          actorUserId: principal.userId,
          tenantId: principal.tenantId,
          action: 'SITE_PUBLISHED',
          targetType: 'Organization',
          targetId: principal.tenantId,
          reasonCategory: 'ONBOARDING',
          createdAt: now,
        },
      })
      return SitePublicationResponseSchema.parse({
        published: true,
        publishedAt: now.toISOString(),
      })
    })
}
