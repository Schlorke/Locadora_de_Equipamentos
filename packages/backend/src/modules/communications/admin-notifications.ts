import { NotificationType, NotificationPriority, Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  message: string
  priority?: NotificationPriority
  actionUrl?: string
  metadata?: Record<string, unknown>
}
interface AdminNotificationInput extends Omit<
  CreateNotificationInput,
  'userId'
> {
  adminIds?: string[]
  dedupeWindowMs?: number
  dedupeKey?: string
}
function notificationData(
  context: TenantContext,
  input: CreateNotificationInput
) {
  return {
    ...input,
    tenantId: context.tenantId,
    priority: input.priority || NotificationPriority.MEDIUM,
    metadata: input.metadata as Prisma.InputJsonValue | undefined,
  }
}
export function createAdminNotificationService({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  async function getAdminUserIds(context: TenantContext) {
    return withTenantTransaction(context, async (tx) => {
      const admins = await tx.membership.findMany({
        where: {
          tenantId: context.tenantId,
          role: 'ADMIN',
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
        },
        select: { userId: true },
      })
      return admins.map((admin) => admin.userId)
    })
  }
  async function createAdminNotifications(
    context: TenantContext,
    input: AdminNotificationInput
  ) {
    return withTenantTransaction(context, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId + ':admin-notifications'}, 0))`
      const admins = await tx.membership.findMany({
        where: {
          tenantId: context.tenantId,
          role: 'ADMIN',
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
          ...(input.adminIds ? { userId: { in: input.adminIds } } : {}),
        },
        select: { userId: true },
      })
      const adminIds = admins.map((admin) => admin.userId)
      if (!adminIds.length) return { count: 0 }
      const existing = await tx.notification.findMany({
        where: {
          tenantId: context.tenantId,
          userId: { in: adminIds },
          type: input.type,
          createdAt: {
            gte: new Date(
              Date.now() - (input.dedupeWindowMs ?? 6 * 60 * 60 * 1000)
            ),
          },
          ...(input.dedupeKey
            ? { metadata: { path: ['dedupeKey'], equals: input.dedupeKey } }
            : {
                title: input.title,
                message: input.message,
                actionUrl: input.actionUrl ?? null,
              }),
        },
        select: { userId: true },
      })
      const existingUsers = new Set(existing.map((row) => row.userId))
      return tx.notification.createMany({
        data: adminIds
          .filter((id) => !existingUsers.has(id))
          .map((userId) =>
            notificationData(context, {
              userId,
              type: input.type,
              title: input.title,
              message: input.message,
              priority: input.priority,
              actionUrl: input.actionUrl,
              metadata: input.dedupeKey
                ? { ...input.metadata, dedupeKey: input.dedupeKey }
                : input.metadata,
            })
          ),
      })
    })
  }

  return { getAdminUserIds, createAdminNotifications }
}
