import { Prisma } from '@prisma/client'
import {
  createRentalTransaction,
  type TenantTransactionRunner,
} from '../rentals/index'
import { readActiveAsaasKeyIdentity } from '../secrets/index'
import type { readAsaasPayment } from './asaas-events'
import { processPaymentInTransaction } from './payment-processor'

export interface AccountReconciliationTarget {
  tenantId: string
  accountId: string
  integrationId: string
  environment: 'sandbox' | 'production'
  keyId: string
  incidentId: string
}
type Progress = {
  incidentId: string
  keyId: string
  cutoff: string
  afterId: string | null
  afterCreatedAt: string | null
  checked: number
  complete: boolean
}
const ACTION = 'ASAAS_QUEUE_RECONCILIATION_PROGRESS'
export class AccountPaymentReconciliationError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}
const reject = (code: string): never => {
  throw new AccountPaymentReconciliationError(code)
}

function progressOf(value: Prisma.JsonValue | null): Progress {
  const p = value as Partial<Progress> | null
  if (
    !p ||
    typeof p !== 'object' ||
    typeof p.incidentId !== 'string' ||
    typeof p.keyId !== 'string' ||
    typeof p.cutoff !== 'string' ||
    !Number.isFinite(Date.parse(p.cutoff)) ||
    !(
      p.afterId === null ||
      (typeof p.afterId === 'string' && p.afterId.length > 0)
    ) ||
    !(
      p.afterCreatedAt === null ||
      (typeof p.afterCreatedAt === 'string' &&
        Number.isFinite(Date.parse(p.afterCreatedAt)))
    ) ||
    Boolean(p.afterId) !== Boolean(p.afterCreatedAt) ||
    !Number.isSafeInteger(p.checked) ||
    p.checked! < 0 ||
    typeof p.complete !== 'boolean'
  )
    return reject('RECONCILIATION_CHECKPOINT_INVALID')
  return p as Progress
}

/** Bounded financial recovery under the business role. Completion is a snapshot, never permission to resume a webhook. */
export function createAccountPaymentReconciliation(options: {
  withTenantTransaction: TenantTransactionRunner
  readPayment(_externalId: string): ReturnType<typeof readAsaasPayment>
  now?: () => Date
  limit?: number
}) {
  const limit = options.limit ?? 5
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5)
    throw new Error('RECONCILIATION_LIMIT_INVALID')
  const now = options.now ?? (() => new Date())
  const { withRentalTransaction } = createRentalTransaction(options)
  async function binding(
    tx: Prisma.TransactionClient,
    target: AccountReconciliationTarget
  ) {
    const account = await tx.paymentAccount.findFirst({
      where: {
        id: target.accountId,
        tenantId: target.tenantId,
        integrationId: target.integrationId,
      },
      include: { integration: true, organization: true },
    })
    const key = await readActiveAsaasKeyIdentity(
      tx,
      {
        tenantId: target.tenantId,
        integrationId: target.integrationId,
        environment: target.environment,
      },
      { lock: true }
    )
    if (
      !account ||
      account.environment !== target.environment ||
      account.mode !== 'ASAAS_CONNECTED_ACCOUNT' ||
      account.disconnectedAt ||
      account.status !== 'RESTRICTED' ||
      account.lastErrorCode !== 'WEBHOOK_RECONCILIATION_REQUIRED' ||
      account.organization.status !== 'ACTIVE' ||
      account.organization.access === 'ARCHIVED' ||
      account.integration.provider !== 'ASAAS' ||
      account.integration.environment !== target.environment ||
      account.integration.credentialSource !== 'VAULT' ||
      !['ACTIVE', 'PROVISIONING'].includes(account.integration.status) ||
      key?.id !== target.keyId ||
      (key.expiresAt && key.expiresAt <= now())
    )
      return reject('RECONCILIATION_BINDING_CHANGED')
    return (
      account.updatedAt.getTime() +
      ':' +
      account.integration.updatedAt.getTime()
    )
  }
  const checkpoint = (
    tx: Prisma.TransactionClient,
    target: AccountReconciliationTarget
  ) =>
    tx.auditLog.findFirst({
      where: {
        tenantId: target.tenantId,
        action: ACTION,
        entity: 'PaymentAccount',
        entityId: target.accountId,
        AND: [
          { changes: { path: ['incidentId'], equals: target.incidentId } },
          { changes: { path: ['keyId'], equals: target.keyId } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { changes: true },
    })
  const save = (
    tx: Prisma.TransactionClient,
    target: AccountReconciliationTarget,
    progress: Progress
  ) =>
    tx.auditLog.create({
      data: {
        tenantId: target.tenantId,
        action: ACTION,
        entity: 'PaymentAccount',
        entityId: target.accountId,
        changes: progress,
      },
    })
  const ambiguous = (
    tx: Prisma.TransactionClient,
    target: AccountReconciliationTarget,
    paymentId: string,
    externalId: string
  ) =>
    tx.paymentAttempt.count({
      where: {
        tenantId: target.tenantId,
        paymentId,
        externalId,
        OR: [
          { integrationId: { not: target.integrationId } },
          { integrationId: null },
        ],
      },
    })
  return async (target: AccountReconciliationTarget) => {
    if (
      !target.incidentId ||
      !target.keyId ||
      !['sandbox', 'production'].includes(target.environment)
    )
      return reject('RECONCILIATION_TARGET_INVALID')
    const work = await withRentalTransaction(target, async (tx) => {
      const stamp = await binding(tx, target)
      const stored = await checkpoint(tx, target)
      const progress: Progress = stored
        ? progressOf(stored.changes)
        : {
            incidentId: target.incidentId,
            keyId: target.keyId,
            cutoff: now().toISOString(),
            afterId: null,
            afterCreatedAt: null,
            checked: 0,
            complete: false,
          }
      if (!stored) await save(tx, target, progress)
      const rows = progress.complete
        ? []
        : await tx.paymentAttempt.findMany({
            where: {
              tenantId: target.tenantId,
              integrationId: target.integrationId,
              provider: 'ASAAS',
              createdAt: { lte: new Date(progress.cutoff) },
              ...(progress.afterId
                ? {
                    OR: [
                      { createdAt: { gt: new Date(progress.afterCreatedAt!) } },
                      {
                        createdAt: new Date(progress.afterCreatedAt!),
                        id: { gt: progress.afterId },
                      },
                    ],
                  }
                : {}),
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: limit + 1,
            include: { payment: true },
          })
      return { stamp, progress, rows }
    })
    if (work.progress.complete)
      return { complete: true, checked: work.progress.checked }
    const rows = work.rows.slice(0, limit)
    for (const attempt of rows) {
      const externalId = attempt.externalId
      if (!externalId && !['FAILED', 'QUEUED'].includes(attempt.status))
        return reject('RECONCILIATION_ISSUANCE_UNCERTAIN')
      // Local references are validated before any provider call, then revalidated before effects.
      if (externalId)
        await options.withTenantTransaction(target, async (tx) => {
          if ((await binding(tx, target)) !== work.stamp)
            return reject('RECONCILIATION_BINDING_CHANGED')
          if (await ambiguous(tx, target, attempt.paymentId, externalId))
            return reject('RECONCILIATION_RESOURCE_MISMATCH')
          if (
            !(await tx.externalResourceTenant.findFirst({
              where: {
                tenantId: target.tenantId,
                integrationId: target.integrationId,
                provider: 'ASAAS',
                resourceType: 'PAYMENT',
                resourceId: attempt.paymentId,
                externalId,
              },
            }))
          )
            return reject('RECONCILIATION_RESOURCE_MISMATCH')
        })
      const remote = externalId
        ? await options
            .readPayment(externalId)
            .catch(() => reject('RECONCILIATION_PROVIDER_UNAVAILABLE'))
        : null
      const review = await withRentalTransaction(target, async (tx) => {
        if ((await binding(tx, target)) !== work.stamp)
          return reject('RECONCILIATION_BINDING_CHANGED')
        const stored = await checkpoint(tx, target)
        const currentProgress = stored ? progressOf(stored.changes) : null
        if (
          !currentProgress ||
          currentProgress.afterId !== work.progress.afterId ||
          currentProgress.checked !== work.progress.checked
        )
          return reject('RECONCILIATION_CHECKPOINT_CHANGED')
        const current = await tx.paymentAttempt.findFirst({
          where: {
            id: attempt.id,
            tenantId: target.tenantId,
            integrationId: target.integrationId,
          },
          include: { payment: true },
        })
        if (
          !current ||
          current.updatedAt.getTime() !== attempt.updatedAt.getTime() ||
          current.payment.updatedAt.getTime() !==
            attempt.payment.updatedAt.getTime() ||
          current.payment.tenantId !== target.tenantId
        )
          return reject('RECONCILIATION_PAYMENT_CHANGED')
        if (remote && externalId) {
          const mapping = await tx.externalResourceTenant.findFirst({
            where: {
              tenantId: target.tenantId,
              integrationId: target.integrationId,
              provider: 'ASAAS',
              resourceType: 'PAYMENT',
              resourceId: current.paymentId,
              externalId,
            },
          })
          if (!mapping) return reject('RECONCILIATION_RESOURCE_MISMATCH')
          if (await ambiguous(tx, target, current.paymentId, externalId))
            return reject('RECONCILIATION_RESOURCE_MISMATCH')
          const payment = current.payment,
            isCurrent = payment.transactionId === externalId
          if (
            !new Prisma.Decimal(remote.amount).equals(current.amount) ||
            remote.billingType !== payment.method ||
            (isCurrent &&
              !new Prisma.Decimal(remote.amount).equals(payment.amount))
          )
            return reject('RECONCILIATION_AMOUNT_OR_METHOD_MISMATCH')
          if (remote.status === 'paid' && !remote.paidAt)
            return reject('RECONCILIATION_PAID_DATE_REQUIRED')
          if (remote.status === 'paid' && !isCurrent) {
            const changed = await tx.paymentAttempt.updateMany({
              where: {
                id: current.id,
                tenantId: target.tenantId,
                status: { notIn: ['PAID', 'REFUNDED'] },
              },
              data: { status: 'PAID' },
            })
            if (changed.count)
              await tx.auditLog.create({
                data: {
                  tenantId: target.tenantId,
                  action: 'PAYMENT_RECONCILIATION_REQUIRED',
                  entity: 'PaymentAttempt',
                  entityId: current.id,
                  changes: {
                    reason: 'PAID_NON_CURRENT_ATTEMPT',
                    paymentId: payment.id,
                  },
                },
              })
            return true // Commit the historical receipt, but keep recovery blocked for review.
          }
          if (remote.status === 'cancelled') {
            if (['PAID', 'REFUNDED'].includes(current.status))
              return reject('RECONCILIATION_STATUS_CONFLICT')
            await tx.paymentAttempt.updateMany({
              where: { id: current.id, tenantId: target.tenantId },
              data: {
                status: 'CANCELLED',
                cancellationStatus: 'CONFIRMED',
                cancelledAt: now(),
              },
            })
          } else if (remote.status === 'refunded') {
            if (
              !['PAID', 'REFUNDED'].includes(current.status) ||
              (isCurrent && !['PAID', 'REFUNDED'].includes(payment.status))
            )
              return reject('RECONCILIATION_STATUS_CONFLICT')
            if (isCurrent)
              await processPaymentInTransaction(target, tx, payment.id, {
                status: 'REFUNDED',
                externalId,
              })
            await tx.paymentAttempt.updateMany({
              where: { id: current.id, tenantId: target.tenantId },
              data: { status: 'REFUNDED' },
            })
          } else {
            if (
              !isCurrent ||
              ['CANCELLED', 'REFUNDED'].includes(current.status) ||
              !['PENDING', 'OVERDUE', 'PAID'].includes(payment.status) ||
              (remote.status !== 'paid' &&
                (current.status === 'PAID' || payment.status === 'PAID'))
            )
              return reject('RECONCILIATION_STATUS_CONFLICT')
            if (remote.status !== 'pending')
              await processPaymentInTransaction(target, tx, payment.id, {
                status: remote.status === 'paid' ? 'PAID' : 'OVERDUE',
                externalId,
                ...(remote.paidAt ? { paidAt: remote.paidAt } : {}),
              })
          }
        }
        work.progress = {
          ...work.progress,
          afterId: current.id,
          afterCreatedAt: current.createdAt.toISOString(),
          checked: work.progress.checked + 1,
        }
        await save(tx, target, work.progress)
        return false
      })
      if (review) return reject('RECONCILIATION_MANUAL_REVIEW_REQUIRED')
    }
    if (work.rows.length <= limit)
      await withRentalTransaction(target, async (tx) => {
        if ((await binding(tx, target)) !== work.stamp)
          return reject('RECONCILIATION_BINDING_CHANGED')
        const missing = await tx.$queryRaw<{ id: string }[]>`
          SELECT er.id FROM external_resource_tenants er
          WHERE er."tenantId"=${target.tenantId} AND er."integrationId"=${target.integrationId}
            AND er.provider='ASAAS' AND er."resourceType"='PAYMENT'
            AND er."createdAt"<=${new Date(work.progress.cutoff)}
            AND NOT EXISTS (SELECT 1 FROM payment_attempts pa
              WHERE pa."tenantId"=er."tenantId" AND pa."integrationId"=er."integrationId"
                AND pa.provider='ASAAS' AND pa."externalId"=er."externalId" AND pa."paymentId"=er."resourceId")
          LIMIT 1`
        if (missing.length)
          return reject('RECONCILIATION_LEGACY_REFERENCE_UNCOVERED')
        const stored = await checkpoint(tx, target)
        if (
          !stored ||
          progressOf(stored.changes).checked !== work.progress.checked
        )
          return reject('RECONCILIATION_CHECKPOINT_CHANGED')
        work.progress = { ...work.progress, complete: true }
        await save(tx, target, work.progress)
      })
    return { complete: work.progress.complete, checked: work.progress.checked }
  }
}
