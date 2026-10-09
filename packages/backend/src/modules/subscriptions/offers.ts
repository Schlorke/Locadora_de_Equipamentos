import type { Prisma } from '@prisma/client'

/** The catalogue and owner commands use the same persisted sale window. */
export function publicOfferWhere(now: Date): Prisma.PlanVersionWhereInput {
  return {
    plan: { isPublic: true, archivedAt: null },
    amount: { gt: '0.00' },
    sellableFrom: { lte: now },
    OR: [{ sellableUntil: null }, { sellableUntil: { gt: now } }],
  }
}
