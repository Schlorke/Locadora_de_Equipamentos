import type { Prisma } from '@prisma/client'

export const RECOVERY_PROGRESS_ACTION =
  'payment-account.reconciliation.progress'
export const RECOVERY_BLOCKED_ACTION = 'payment-account.reconciliation.blocked'

/** Only a start after the last confirmed configuration belongs to the current incident. */
export async function readAccountRecoveryIncident(
  tx: Prisma.TransactionClient,
  tenantId: string,
  accountId: string
) {
  const latest = (action: string) =>
    tx.platformAuditLog.findFirst({
      where: {
        tenantId,
        targetId: accountId,
        targetType: 'PaymentAccount',
        action,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, createdAt: true },
    })
  const confirmed = await latest('payment-account.configuration.confirmed')
  const started = await latest('payment-account.reconciliation.started')
  if (
    !started ||
    (confirmed &&
      (started.createdAt < confirmed.createdAt ||
        (started.createdAt.getTime() === confirmed.createdAt.getTime() &&
          started.id <= confirmed.id)))
  )
    return null
  return started
}
