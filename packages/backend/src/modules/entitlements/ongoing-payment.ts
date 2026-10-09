import type { Prisma } from '@prisma/client'

/** Commercial eligibility only: billing independently checks owner/FINANCIAL WRITE. */
export async function isOngoingPayment(
  tx: Prisma.TransactionClient,
  tenantId: string,
  reference: { rentalId?: string | null; quoteId?: string | null }
) {
  if (!reference.rentalId || reference.quoteId !== undefined) return false
  const subscription = await tx.subscription.findFirst({
    where: { tenantId, status: { not: 'CANCELED' } },
    select: { suspendedAt: true },
  })
  if (!subscription?.suspendedAt) return false
  return !!(await tx.rentals.findFirst({
    where: {
      id: reference.rentalId,
      tenantId,
      status: { in: ['ACTIVE', 'OVERDUE', 'PENDING_RETURN'] },
      checkOutAt: { lt: subscription.suspendedAt },
      checkInAt: null,
    },
    select: { id: true },
  }))
}
