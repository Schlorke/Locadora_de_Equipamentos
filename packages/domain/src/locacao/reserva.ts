import { obligationBalance, type MoneyValue } from './saldo'

export interface ReservationInterval {
  startDate: Date
  endDate: Date
  quantity: number
}

export interface ObligationPayment {
  status: string
  type: string
  amount: MoneyValue
}

export interface RentalReservationState {
  status: string | null
  /** Total da obrigação base: `rentals.total` (na conversão, `finalTotal ?? total` do orçamento). */
  total: MoneyValue
  quote?: { status: string; paymentTerms?: string | null } | null
  payments: ReadonlyArray<ObligationPayment>
}

const SETTLEMENT_TYPES: ReadonlyArray<string> = ['RENTAL', 'DEPOSIT']
/** Cobranças anuladas permanecem como histórico e não contam para a obrigação vigente. */
const VOIDED_STATUSES: ReadonlyArray<string> = ['CANCELLED', 'REFUNDED']

/**
 * Quitação da obrigação base (cobranças RENTAL/DEPOSIT) sobre as cobranças
 * vigentes: CANCELLED e REFUNDED são ignoradas; as demais precisam estar PAID,
 * com ao menos uma PAID e saldo em centavos `obligationBalance(total, pagas)`
 * <= 0 — o mesmo saldo que `resolvePaymentObligation` cobra e que a conversão
 * de orçamento usa, então um total fracionário pago pelo valor cobrado fica
 * quitado. Uma cobrança PENDING/OVERDUE vigente continua bloqueando até ser
 * paga ou anulada.
 */
export function isObligationSettled(
  total: MoneyValue,
  payments: ReadonlyArray<ObligationPayment>
): boolean {
  const current = payments.filter(
    (payment) =>
      SETTLEMENT_TYPES.includes(payment.type) &&
      !VOIDED_STATUSES.includes(payment.status)
  )
  if (
    current.length === 0 ||
    current.some((payment) => payment.status !== 'PAID')
  )
    return false
  return obligationBalance(
    total,
    current.map((payment) => payment.amount)
  ).lte(0)
}

export function blocksRentalInventory(rental: RentalReservationState): boolean {
  if (rental.quote?.status === 'REJECTED') return false
  if (['ACTIVE', 'OVERDUE', 'PENDING_RETURN'].includes(rental.status ?? ''))
    return true
  if (rental.status !== 'PENDING') return false
  if (!rental.quote) return true
  if (
    rental.quote.paymentTerms === 'AT_END' &&
    ['APPROVED', 'COMPLETED'].includes(rental.quote.status)
  )
    return true
  return isObligationSettled(rental.total, rental.payments)
}

export function hasCheckoutPayment(rental: RentalReservationState): boolean {
  if (!rental.quote || rental.quote.paymentTerms === 'AT_END') return true
  return isObligationSettled(rental.total, rental.payments)
}

export function peakReservedQuantity(
  intervals: ReadonlyArray<ReservationInterval>,
  startDate: Date,
  endDate: Date
): number {
  const start = startDate.getTime()
  const end = endDate.getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error('Período de locação inválido')
  }
  const events: Array<{ at: number; quantity: number }> = []
  for (const interval of intervals) {
    const from = Math.max(start, interval.startDate.getTime())
    const to = Math.min(end, interval.endDate.getTime())
    if (from > to || !Number.isFinite(from) || !Number.isFinite(to)) continue
    events.push(
      { at: from, quantity: interval.quantity },
      { at: to, quantity: -interval.quantity }
    )
  }
  // Datas mantêm a semântica inclusiva existente: uma saída e uma entrada no mesmo instante se sobrepõem.
  events.sort((a, b) => a.at - b.at || b.quantity - a.quantity)
  let current = 0
  let peak = 0
  for (const event of events) {
    current += event.quantity
    peak = Math.max(peak, current)
  }
  return peak
}
