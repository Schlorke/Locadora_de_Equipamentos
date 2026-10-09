import {
  PublicPlansResponseSchema,
  type PublicPlansResponse,
} from '@gb-locacoes/contracts/subscription'
import type { PlatformTransaction } from '../platform-scope/index'
import { publicOfferWhere } from './offers'

/** Published offers only. Overlapping sale windows and billing intervals remain distinct offers. */
export function createPublicPlanCatalog(ports: {
  transaction: PlatformTransaction
  now?: () => Date
}): () => Promise<PublicPlansResponse> {
  return async () => {
    const now = (ports.now ?? (() => new Date()))()
    return ports.transaction(async (tx) => {
      const offers = await tx.planVersion.findMany({
        where: publicOfferWhere(now),
        orderBy: [
          { plan: { sortOrder: 'asc' } },
          { plan: { code: 'asc' } },
          { version: 'desc' },
          { id: 'asc' },
        ],
        // The extra row detects a catalogue that violates the shared limit instead of silently truncating it.
        take: 11,
        select: {
          id: true,
          version: true,
          interval: true,
          amount: true,
          trialDays: true,
          entitlements: true,
          plan: { select: { code: true, name: true } },
        },
      })
      return PublicPlansResponseSchema.parse({
        plans: offers.map((offer) => ({
          planVersionId: offer.id,
          code: offer.plan.code,
          name: offer.plan.name,
          version: offer.version,
          interval: offer.interval,
          amount: offer.amount.toFixed(2),
          trialDays: offer.trialDays,
          entitlements: offer.entitlements,
        })),
      })
    })
  }
}
