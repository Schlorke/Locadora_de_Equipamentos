import type { PlatformInvoice, Subscription } from '@prisma/client'
import {
  diaCivilDeColunaDate,
  type FatosDaAssinatura,
} from '@gb-locacoes/domain/assinatura'

const civil = (date: Date | null) => (date ? diaCivilDeColunaDate(date) : null)

/** Paid cycles may arrive before reconciliation; commands must protect their full period too. */
export function subscriptionCurrentPeriod(
  sub: Subscription & { invoices: PlatformInvoice[] }
) {
  const paidCycles = sub.invoices.filter(
    (i) =>
      i.kind === 'CYCLE' && i.status === 'PAID' && i.periodEnd && i.periodStart
  )
  paidCycles.sort((a, b) => b.periodEnd!.getTime() - a.periodEnd!.getTime())
  const period = paidCycles[0]
  const currentEnd =
    period &&
    (!sub.currentPeriodEnd || period.periodEnd! > sub.currentPeriodEnd)
      ? period.periodEnd
      : sub.currentPeriodEnd
  return {
    paidCycles,
    currentEnd,
    currentStart:
      currentEnd === period?.periodEnd
        ? period.periodStart
        : sub.currentPeriodStart,
  }
}

/** One persisted-to-domain mapping for projection and notifications. */
export function subscriptionFacts(
  sub: Subscription & { invoices: PlatformInvoice[] },
  currentPeriodEnd = sub.currentPeriodEnd
): FatosDaAssinatura {
  return {
    billingMode: sub.billingMode,
    createdAt: sub.createdAt,
    complimentaryUntil: civil(sub.complimentaryUntil),
    trialEndsAt: civil(sub.trialEndsAt),
    currentPeriodEnd: civil(currentPeriodEnd),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    canceledAt: sub.canceledAt,
    invoices: sub.invoices.map((i) => ({
      id: i.id,
      kind: i.kind,
      status: i.status,
      amount: i.amount.toFixed(2),
      dueDate: diaCivilDeColunaDate(i.dueDate),
      periodEnd: civil(i.periodEnd),
      paidAt: i.paidAt,
      chargebackAt: i.chargebackAt,
      voluntaryRefund: i.voluntaryRefund,
      settlesInvoiceId: i.settlesInvoiceId,
      debtWaivedAt: i.debtWaivedAt,
    })),
  }
}
