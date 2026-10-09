import type { Prisma } from '@prisma/client'
import { BillingProviderError } from '../billing/index'
import {
  purgeProvisioningRequest,
  type ProvisioningPurgeReason,
} from './provisioning-request'

const referenceId = /^[A-Za-z0-9_-]{1,128}$/
/** Provider answers to the root credential: never evidence about the company's data. */
const ROOT_REJECTIONS = new Set([
  'VALIDATION',
  'AUTHENTICATION',
  'FORBIDDEN',
  'NOT_FOUND',
  'CLIENT_ERROR',
])

type Account = Prisma.PaymentAccountGetPayload<{
  include: { integration: true }
}>
export type ObservedSubaccount = {
  id: string
  document: string
  walletId: string | null
}

/**
 * Lookup by CNPJ with the root credential. A malformed or ambiguous answer is evidence nobody can trust (review);
 * a 4xx from the provider means the root credential or its permissions, never the company, so the request waits.
 */
export function classifyLookupFailure(
  error: unknown
):
  | { kind: 'INVALID' }
  | { kind: 'ROOT_REJECTED'; reason: string }
  | { kind: 'UNAVAILABLE'; retryAfterSeconds: number | null } {
  if (error instanceof BillingProviderError) {
    if (error.code === 'INVALID_RESPONSE') return { kind: 'INVALID' }
    if (error.code === 'REJECTED')
      return error.reason && ROOT_REJECTIONS.has(error.reason)
        ? { kind: 'ROOT_REJECTED', reason: error.reason }
        : { kind: 'INVALID' }
    return { kind: 'UNAVAILABLE', retryAfterSeconds: error.retryAfterSeconds }
  }
  return { kind: 'UNAVAILABLE', retryAfterSeconds: null }
}

/** Review state with a remote account (or integrity) involved. Purges the request in the same transaction. */
export async function blockProvisioning(
  tx: Prisma.TransactionClient,
  account: { id: string; tenantId: string },
  code: string,
  at: Date
) {
  await tx.paymentAccount.update({
    where: { id: account.id },
    data: { status: 'BLOCKED', lastErrorCode: code, lockedUntil: null },
  })
  await purgeProvisioningRequest(tx, account.id, 'BLOCKED', at)
  await tx.platformAuditLog.create({
    data: {
      actorKind: 'SYSTEM',
      action: 'payment-account.provisioning.blocked',
      tenantId: account.tenantId,
      targetType: 'PaymentAccount',
      targetId: account.id,
      reasonCategory: code,
    },
  })
}

/**
 * A request that never reached the provider is returned to the owner (decision D-3 of 2026-10-07): the account is
 * disconnected, its integration becomes a disabled shell without token hashes (never blocking a new request or a
 * connection) and the declared values are purged, atomically. The reason category goes to the platform audit only.
 */
export async function cancelProvisioningShell(
  tx: Prisma.TransactionClient,
  account: { id: string; tenantId: string; integrationId: string },
  code: string,
  at: Date,
  options: {
    purgeReason?: 'CANCELLED' | 'REJECTED'
    action?: string
    metadata?: Prisma.InputJsonValue
  } = {}
) {
  await tx.paymentAccount.update({
    where: { id: account.id },
    data: {
      status: 'DISCONNECTED',
      disconnectedAt: at,
      lastErrorCode: code,
      lockedUntil: null,
    },
  })
  await tx.tenantIntegration.update({
    where: { id: account.integrationId },
    data: {
      status: 'DISABLED',
      webhookTokenHash: null,
      webhookTokenPreviousHash: null,
      webhookTokenPreviousUntil: null,
    },
  })
  await purgeProvisioningRequest(
    tx,
    account.id,
    options.purgeReason ?? 'CANCELLED',
    at
  )
  await tx.platformAuditLog.create({
    data: {
      actorKind: 'SYSTEM',
      action: options.action ?? 'payment-account.provisioning.cancelled',
      tenantId: account.tenantId,
      targetType: 'PaymentAccount',
      targetId: account.id,
      reasonCategory: code,
      ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
    },
  })
}

/**
 * Can this provider account be bound to this local account? Checks the references already recorded and, under
 * advisory locks of the id and the wallet, that no other account or integration owns them.
 */
export async function observedReferenceProblem(
  tx: Prisma.TransactionClient,
  account: Account,
  found: ObservedSubaccount,
  document: string
) {
  if (
    found.document !== document ||
    !referenceId.test(found.id) ||
    (found.walletId !== null && !referenceId.test(found.walletId)) ||
    (account.providerAccountId && account.providerAccountId !== found.id) ||
    (account.walletId && account.walletId !== found.walletId) ||
    (account.integration.externalAccountId &&
      account.integration.externalAccountId !== found.id)
  )
    return 'SUBACCOUNT_REFERENCE_MISMATCH' as const
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`subaccount-reference:${found.id}`},0))`
  if (found.walletId)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`subaccount-wallet:${found.walletId}`},0))`
  const conflict = await tx.paymentAccount.findFirst({
    where: {
      id: { not: account.id },
      OR: [
        { providerAccountId: found.id },
        ...(found.walletId ? [{ walletId: found.walletId }] : []),
      ],
    },
    select: { id: true },
  })
  const integrationConflict = await tx.tenantIntegration.findFirst({
    where: {
      id: { not: account.integrationId },
      provider: 'ASAAS',
      externalAccountId: found.id,
    },
    select: { id: true },
  })
  return conflict || integrationConflict
    ? ('SUBACCOUNT_REFERENCE_CONFLICT' as const)
    : null
}

/**
 * A provider account exists but its key is not in the vault: bind the references, require manual key recovery
 * and purge the request, atomically. Shared by the creation worker and the uncertain-creation inspection.
 */
export async function bindObservedSubaccount(
  tx: Prisma.TransactionClient,
  account: Account,
  found: ObservedSubaccount,
  options: {
    document: string
    code: 'SUBACCOUNT_KEY_RECOVERY_REQUIRED' | 'SUBACCOUNT_KEY_STORE_FAILED'
    purgeReason: ProvisioningPurgeReason
    at: Date
  }
) {
  const problem = await observedReferenceProblem(
    tx,
    account,
    found,
    options.document
  )
  if (problem) {
    await blockProvisioning(tx, account, problem, options.at)
    return 'BLOCKED' as const
  }
  await tx.tenantIntegration.update({
    where: { id: account.integrationId },
    data: { externalAccountId: found.id },
  })
  await tx.paymentAccount.update({
    where: { id: account.id },
    data: {
      providerAccountId: found.id,
      walletId: found.walletId,
      status: 'KEY_RECOVERY_REQUIRED',
      healthIssue: 'KEY_DISABLED',
      lastErrorCode: options.code,
      lockedUntil: null,
      lastSyncedAt: options.at,
    },
  })
  await purgeProvisioningRequest(
    tx,
    account.id,
    options.purgeReason,
    options.at
  )
  await tx.platformAuditLog.create({
    data: {
      actorKind: 'SYSTEM',
      action: 'payment-account.provisioning.key-recovery-required',
      tenantId: account.tenantId,
      targetType: 'PaymentAccount',
      targetId: account.id,
      reasonCategory: options.code,
    },
  })
  return 'BOUND' as const
}
