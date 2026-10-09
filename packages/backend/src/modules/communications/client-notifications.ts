import type { Prisma } from '@prisma/client'
import type { NotificationListQuery } from '@gb-locacoes/contracts/notifications'
import type { TenantPrincipal } from '../identity/index'

/** Read only the current recipient's inbox inside the caller's tenant transaction. */
export async function listCustomerNotifications(
  tx: Pick<Prisma.TransactionClient, 'notification'>,
  principal: Pick<TenantPrincipal, 'tenantId' | 'userId'>,
  query: NotificationListQuery
) {
  const { page, limit, type, isRead } = query
  const skip = (page - 1) * limit
  const where: Prisma.NotificationWhereInput = {
    tenantId: principal.tenantId,
    userId: principal.userId,
  }
  if (type) where.type = type
  if (isRead !== undefined) where.isRead = isRead === 'true'

  const [notifications, total] = await Promise.all([
    tx.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    tx.notification.count({ where }),
  ])
  const [unreadCount, byType] = await Promise.all([
    tx.notification.count({
      where: {
        tenantId: principal.tenantId,
        userId: principal.userId,
        isRead: false,
      },
    }),
    tx.notification.groupBy({
      by: ['type'],
      where: {
        tenantId: principal.tenantId,
        userId: principal.userId,
        isRead: false,
      },
      _count: { type: true },
    }),
  ])
  const stats = {
    total,
    unread: unreadCount,
    byType: byType.reduce(
      (acc, item) => {
        acc[item.type.toLowerCase()] = item._count.type
        return acc
      },
      {} as Record<string, number>
    ),
  }
  return {
    notifications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    stats,
  }
}
