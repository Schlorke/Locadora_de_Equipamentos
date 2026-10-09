import { enqueueOutbox } from '@gb-locacoes/backend/outbox'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { RentalMutationError, type RentalTransaction } from '../rentals/index'
import {
  PaymentStatus,
  Prisma,
  type PaymentBillingStatus,
} from '@prisma/client'
import Decimal from 'decimal.js'

/**
 * Processa pagamento e atualiza status relacionado
 */
export interface ProcessPaymentOptions {
  status: PaymentStatus
  paidAt?: Date
  amount?: Decimal
  externalId?: string
}

function mapStatusToBillingStatus(status: PaymentStatus): PaymentBillingStatus {
  switch (status) {
    case 'PAID':
      return 'PAID'
    case 'OVERDUE':
      return 'UNPAID'
    case 'CANCELLED':
    case 'REFUNDED':
      return 'SETTLED'
    case 'PENDING':
    default:
      return 'AWAITING_PAYMENT'
  }
}

export function createPaymentProcessor({
  withRentalTransaction,
}: {
  withRentalTransaction: RentalTransaction
}) {
  async function processPayment(
    context: TenantContext,
    paymentId: string,
    options: ProcessPaymentOptions
  ): Promise<void> {
    await withRentalTransaction(context, (tx) =>
      processPaymentInTransaction(context, tx, paymentId, options)
    )
  }
  return { processPayment }
}
export async function processPaymentInTransaction(
  context: TenantContext,
  tx: Prisma.TransactionClient,
  paymentId: string,
  options: ProcessPaymentOptions
): Promise<void> {
  const payment = await tx.payment.findFirst({
    where: { id: paymentId, tenantId: context.tenantId },
    include: { quote: true },
  })
  if (!payment) throw new Error('Pagamento não encontrado')
  if (
    options.externalId !== undefined &&
    payment.transactionId !== options.externalId
  )
    throw new RentalMutationError(
      'Identificador externo diverge da cobrança vigente',
      409,
      'PAYMENT_RECONCILIATION_REQUIRED'
    )
  const markAttemptPaid = async () => {
    if (!payment.transactionId) return
    await tx.paymentAttempt.updateMany({
      where: {
        tenantId: context.tenantId,
        paymentId: payment.id,
        externalId: payment.transactionId,
        status: { notIn: ['PAID', 'CANCELLED', 'REFUNDED'] },
      },
      data: { status: 'PAID' },
    })
  }
  if (payment.status === options.status) {
    if (payment.status === 'PAID') await markAttemptPaid()
    if (payment.status === 'PAID' && payment.quoteId)
      await enqueueOutbox(tx, {
        tenantId: context.tenantId,
        topic: 'quote.payment.convert',
        aggregateId: payment.quoteId,
        payload: { paymentId: payment.id },
        dedupeKey: `quote-payment-convert:${payment.id}`,
      })
    return
  }
  const allowed: Record<PaymentStatus, PaymentStatus[]> = {
    PENDING: [],
    PAID: ['PENDING', 'OVERDUE'],
    OVERDUE: ['PENDING'],
    CANCELLED: ['PENDING', 'OVERDUE'],
    REFUNDED: ['PAID'],
  }
  if (!allowed[options.status].includes(payment.status)) return
  const paidAt = options.paidAt ?? new Date()
  const updated = await tx.payment.updateMany({
    where: {
      tenantId: context.tenantId,
      id: paymentId,
      status: { in: allowed[options.status] },
    },
    data: {
      status: options.status,
      ...(options.status === 'PAID' ? { paidAt } : {}),
      billingStatus: mapStatusToBillingStatus(options.status),
      settledAt: ['PAID', 'CANCELLED', 'REFUNDED'].includes(options.status)
        ? paidAt
        : null,
      ...(options.amount !== undefined ? { amount: options.amount } : {}),
    },
  })
  if (updated.count > 0 && options.status === 'PAID') await markAttemptPaid()
  if (updated.count > 0 && options.status === 'PAID' && payment.quoteId)
    await enqueueOutbox(tx, {
      tenantId: context.tenantId,
      topic: 'quote.payment.convert',
      aggregateId: payment.quoteId,
      payload: { paymentId: payment.id },
      dedupeKey: `quote-payment-convert:${payment.id}`,
    })
  if (
    updated.count > 0 &&
    options.status === 'PAID' &&
    payment.quoteId &&
    payment.quote?.approvedAt
  ) {
    await tx.quote.updateMany({
      where: {
        tenantId: context.tenantId,
        id: payment.quoteId,
        status: 'PENDING',
      },
      data: { status: 'APPROVED' },
    })
  }
}
