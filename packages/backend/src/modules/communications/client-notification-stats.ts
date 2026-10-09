import type { Prisma } from '@prisma/client'
import type { TenantPrincipal } from '../identity/index'

/** Read the complete recipient inbox counts inside the caller's tenant transaction. */
export async function readCustomerNotificationStats(
  tx: Pick<Prisma.TransactionClient, 'notification'>,
  principal: Pick<TenantPrincipal, 'tenantId' | 'userId'>
) {
  const [total, unread, byType, byPriority] = await Promise.all([
    // Total de notificações
    tx.notification.count({
      where: { tenantId: principal.tenantId, userId: principal.userId },
    }),
    // Não lidas
    tx.notification.count({
      where: {
        tenantId: principal.tenantId,
        userId: principal.userId,
        isRead: false,
      },
    }),
    // Por tipo (não lidas)
    tx.notification.groupBy({
      by: ['type'],
      where: {
        tenantId: principal.tenantId,
        userId: principal.userId,
        isRead: false,
      },
      _count: { type: true },
    }),
    // Por prioridade (não lidas)
    tx.notification.groupBy({
      by: ['priority'],
      where: {
        tenantId: principal.tenantId,
        userId: principal.userId,
        isRead: false,
      },
      _count: { priority: true },
    }),
  ])

  return {
    total,
    unread,
    byType: byType.reduce(
      (acc, item) => {
        acc[item.type.toLowerCase()] = item._count.type
        return acc
      },
      {} as Record<string, number>
    ),
    byPriority: byPriority.reduce(
      (acc, item) => {
        acc[item.priority.toLowerCase()] = item._count.priority
        return acc
      },
      {} as Record<string, number>
    ),
  }
}
