import type { Prisma } from '@prisma/client'
import {
  EntitlementsV1Schema,
  EntitlementOverrideSchema,
} from '@gb-locacoes/contracts/entitlements'
import { direitosEfetivos } from '@gb-locacoes/domain/assinatura'

/** The caller supplies its scoped transaction; this never opens another one. */
export async function readEffectiveRights(
  tx: Prisma.TransactionClient,
  tenantId: string,
  instant: Date
) {
  const subscription = await tx.subscription.findFirst({
    where: { tenantId, status: { not: 'CANCELED' } },
    select: { planVersion: { select: { entitlements: true } } },
  })
  return readEffectiveRightsForPlan(
    tx,
    tenantId,
    subscription?.planVersion.entitlements,
    instant
  )
}

/** Also supports the owner's historical, canceled subscription without inventing an active plan. */
export async function readEffectiveRightsForPlan(
  tx: Prisma.TransactionClient,
  tenantId: string,
  entitlements: unknown,
  instant: Date
) {
  const base = EntitlementsV1Schema.safeParse(entitlements)
  if (!base.success) return null
  const overrides = await tx.entitlementOverride.findMany({
    where: {
      tenantId,
      createdAt: { lte: instant },
      OR: [{ revokedAt: null }, { revokedAt: { gt: instant } }],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  const valid = overrides.filter(
    (row) =>
      EntitlementOverrideSchema.safeParse({ key: row.key, value: row.value })
        .success
  )
  return direitosEfetivos(base.data, valid, instant).direitos
}
