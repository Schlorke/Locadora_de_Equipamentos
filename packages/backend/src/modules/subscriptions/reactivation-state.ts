import type { Prisma } from '@prisma/client'

export const REACTIVATION_REQUESTED = 'REACTIVATION_REQUESTED'
export const REACTIVATION_READY = 'REACTIVATION_READY'
export const REACTIVATION_PREDECESSOR = 'REACTIVATION_PREDECESSOR'

/** A durable receipt prevents both cron and direct activation from bypassing cleanup. */
export async function reactivationPending(
  tx: Prisma.TransactionClient,
  subscriptionId: string
) {
  const request = await tx.subscriptionEvent.findFirst({
    where: { subscriptionId, reason: REACTIVATION_REQUESTED },
    select: { id: true },
  })
  return Boolean(
    request &&
    !(await tx.subscriptionEvent.findFirst({
      where: { subscriptionId, reason: REACTIVATION_READY },
      select: { id: true },
    }))
  )
}
