import type { Prisma } from '@prisma/client'
import type { TenantPrincipal } from '../identity/index'

type Recipient = Pick<TenantPrincipal, 'tenantId' | 'userId'>
type NotificationTransaction = Pick<Prisma.TransactionClient, 'notification'>

/** Preserve the ownership lookup and write in the caller's tenant transaction. */
export async function markCustomerNotificationRead(
  tx: NotificationTransaction,
  principal: Recipient,
  id: string
) {
  const where = { tenantId: principal.tenantId, userId: principal.userId, id }
  const notification = await tx.notification.findFirst({ where })
  if (!notification) return null
  return tx.notification.update({
    where,
    data: { isRead: true, readAt: new Date() },
  })
}

export async function deleteCustomerNotification(
  tx: NotificationTransaction,
  principal: Recipient,
  id: string
) {
  const where = { tenantId: principal.tenantId, userId: principal.userId, id }
  const notification = await tx.notification.findFirst({ where })
  if (!notification) return false
  await tx.notification.delete({ where })
  return true
}

export async function markAllCustomerNotificationsRead(
  tx: NotificationTransaction,
  principal: Recipient
) {
  const result = await tx.notification.updateMany({
    where: {
      tenantId: principal.tenantId,
      userId: principal.userId,
      isRead: false,
    },
    data: { isRead: true, readAt: new Date() },
  })
  return result.count
}
