import type { Prisma, PlatformInvoice, Subscription } from '@prisma/client'
import { periodoMensal } from '@gb-locacoes/domain/assinatura'
import { sameAmount, type AsaasPlatformInvoice } from '../billing/index'

type CurrentSubscription = Subscription & {
  planVersion: { amount: Prisma.Decimal }
}

export function matchesSubscriptionInvoice(
  sub: CurrentSubscription,
  invoice: PlatformInvoice | null,
  remote: AsaasPlatformInvoice
) {
  const reference = remote.externalReference
  return (
    sub.providerCustomerId === remote.customer &&
    sameAmount(remote.amount, invoice?.amount ?? sub.planVersion.amount) &&
    (!reference ||
      reference === 'sub:' + sub.id ||
      (invoice && reference === 'inv:' + invoice.id)) &&
    (remote.subscription === null ||
      remote.subscription === sub.providerSubscriptionId) &&
    (invoice
      ? invoice.tenantId === sub.tenantId && invoice.subscriptionId === sub.id
      : Boolean(sub.providerSubscriptionId) &&
        remote.subscription === sub.providerSubscriptionId)
  )
}

/** Webhook and periodic jobs use one financial mapping; caller owns locks and transaction. */
export async function applySubscriptionInvoice(
  tx: Prisma.TransactionClient,
  sub: CurrentSubscription,
  invoice: PlatformInvoice | null,
  remote: AsaasPlatformInvoice,
  now: Date,
  audit: { id: string; type: string }
) {
  const regressed =
    (invoice?.status === 'PAID' &&
      !['PAID', 'REFUNDED', 'CHARGEBACK'].includes(remote.status)) ||
    (invoice?.status === 'REFUNDED' && remote.status !== 'REFUNDED')
  const status =
    invoice && (regressed || remote.unknownStatus)
      ? invoice.status
      : invoice?.debtWaivedAt &&
          invoice.canceledReason === 'REACTIVATION_WAIVER' &&
          ['PENDING', 'OVERDUE', 'CANCELED'].includes(remote.status)
        ? 'CANCELED'
        : remote.status
  const period = periodoMensal(remote.dueDate)
  const dates =
    !invoice ||
    (invoice.kind === 'CYCLE' &&
      ['PENDING', 'OVERDUE', 'CANCELED'].includes(invoice.status))
      ? {
          dueDate: new Date(remote.dueDate + 'T00:00:00Z'),
          periodStart: new Date(period.periodStart + 'T00:00:00Z'),
          periodEnd: new Date(period.periodEnd + 'T00:00:00Z'),
        }
      : invoice.kind === 'CYCLE' && (!invoice.periodStart || !invoice.periodEnd)
        ? {
            periodStart:
              invoice.periodStart ??
              new Date(period.periodStart + 'T00:00:00Z'),
            periodEnd:
              invoice.periodEnd ?? new Date(period.periodEnd + 'T00:00:00Z'),
          }
        : {}
  const data = {
    status,
    providerStatus: remote.providerStatus,
    syncedAt: now,
    ...dates,
    paidAt: remote.paidAt ?? invoice?.paidAt ?? null,
    chargebackAt:
      status === 'CHARGEBACK'
        ? (invoice?.chargebackAt ?? now)
        : (invoice?.chargebackAt ?? null),
    billingType: remote.billingType,
    invoiceUrl: remote.invoiceUrl,
    canceledReason:
      invoice?.canceledReason === 'REACTIVATION_WAIVER'
        ? invoice.canceledReason
        : status === 'CANCELED'
          ? (invoice?.canceledReason ?? 'PROVIDER_DELETED')
          : null,
  }
  const updated = invoice
    ? await tx.platformInvoice.update({ where: { id: invoice.id }, data })
    : await tx.platformInvoice.create({
        data: {
          ...data,
          tenantId: sub.tenantId,
          subscriptionId: sub.id,
          providerPaymentId: remote.id,
          amount: remote.amount,
          dueDate: new Date(remote.dueDate + 'T00:00:00Z'),
          periodStart: new Date(period.periodStart + 'T00:00:00Z'),
          periodEnd: new Date(period.periodEnd + 'T00:00:00Z'),
        },
      })
  if (
    sub.status === 'CANCELED' &&
    status === 'PAID' &&
    invoice?.status !== 'PAID'
  )
    await tx.platformAuditLog.create({
      data: {
        actorKind: 'SYSTEM',
        tenantId: sub.tenantId,
        action: 'subscription.invoice.reconciliation',
        targetType: 'PlatformInvoice',
        targetId: updated.id,
        reasonCategory: 'PAID_AFTER_SUBSCRIPTION_CANCEL',
      },
    })
  if (regressed || remote.unknownStatus)
    await tx.platformAuditLog.create({
      data: {
        actorKind: 'SYSTEM',
        tenantId: sub.tenantId,
        action: 'subscription.invoice.reconciliation',
        targetType: audit.type,
        targetId: audit.id,
        reasonCategory: regressed
          ? 'INVOICE_STATUS_REGRESSION'
          : 'UNKNOWN_PROVIDER_STATUS',
      },
    })
  return updated
}
