import type { Prisma } from '@prisma/client'

/**
 * Why a creation request lost its declared income and mobile phone (ADR SaaS B.8, decision D-2 of 2026-10-07):
 * both exist only while a POST /accounts is still possible.
 */
export type ProvisioningPurgeReason =
  | 'CREATED'
  | 'UNCERTAIN'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXISTING_ACCOUNT'
  | 'BLOCKED'

/** Idempotent and in the caller's transaction: a purged request never changes again (database trigger). */
export async function purgeProvisioningRequest(
  tx: Prisma.TransactionClient,
  paymentAccountId: string,
  reason: ProvisioningPurgeReason,
  at: Date
) {
  await tx.paymentAccountProvisioningRequest.updateMany({
    where: { paymentAccountId, purgedAt: null },
    data: {
      purgedAt: at,
      purgeReason: reason,
      incomeValue: null,
      mobilePhone: null,
    },
  })
}

/** Canonical purge reason for an account that can no longer reach POST /accounts. */
export function purgeReasonFor(status: string): ProvisioningPurgeReason {
  if (status === 'DISCONNECTED') return 'CANCELLED'
  if (status === 'BLOCKED') return 'BLOCKED'
  if (status === 'UNKNOWN' || status === 'KEY_RECOVERY_REQUIRED')
    return 'UNCERTAIN'
  return 'CREATED'
}
