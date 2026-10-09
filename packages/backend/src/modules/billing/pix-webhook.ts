import Decimal from 'decimal.js'
import { PixWebhookEventSchema as PaymentEvent } from '@gb-locacoes/contracts/payments'
import type {
  AuthenticatedTenantWebhook,
  createTenantWebhookAuthentication,
} from '../identity/index'
import type { TenantTransactionRunner } from '../rentals/index'
import type { createPaymentProcessor } from './payment-processor'

export function createPixWebhookConsumer({
  withTenantTransaction,
  processPayment,
  resolveWebhookResource,
}: {
  withTenantTransaction: TenantTransactionRunner
  processPayment: ReturnType<typeof createPaymentProcessor>['processPayment']
  resolveWebhookResource: ReturnType<
    typeof createTenantWebhookAuthentication
  >['resolveWebhookResource']
}) {
  async function consumeWebhook(authenticated: AuthenticatedTenantWebhook) {
    try {
      const parsed = PaymentEvent.safeParse(authenticated.body)
      if (!parsed.success) {
        return Response.json({ error: 'Invalid payload' }, { status: 400 })
      }
      const { paymentId, status, transactionId, paidAt } = parsed.data
      const { context, integration } = authenticated
      const resourceId = await resolveWebhookResource(
        integration,
        'PAYMENT',
        transactionId || paymentId
      )
      if (!resourceId || resourceId !== paymentId)
        return Response.json({ error: 'Payment not found' }, { status: 404 })
      const payment = await withTenantTransaction(context, (tx) =>
        tx.payment.findFirst({
          where: { id: resourceId, tenantId: context.tenantId },
        })
      )
      if (!payment) {
        return Response.json({ error: 'Payment not found' }, { status: 404 })
      }
      if (payment.method !== 'PIX') {
        return Response.json(
          { error: 'Invalid payment method' },
          { status: 400 }
        )
      }
      if (payment.transactionId !== (transactionId || paymentId)) {
        return Response.json({ error: 'Transaction mismatch' }, { status: 400 })
      }

      if (
        status === 'PAID' &&
        ['PENDING', 'OVERDUE'].includes(payment.status)
      ) {
        if (
          parsed.data.amount === undefined ||
          !new Decimal(String(payment.amount)).equals(parsed.data.amount)
        )
          return Response.json(
            { error: 'Payment amount requires reconciliation' },
            { status: 409 }
          )
        await processPayment(context, payment.id, {
          status: 'PAID',
          externalId: transactionId || paymentId,
          paidAt: paidAt ? new Date(paidAt) : new Date(),
        })
        if (transactionId) {
          await withTenantTransaction(context, (tx) =>
            tx.payment.updateMany({
              where: {
                id: payment.id,
                tenantId: context.tenantId,
                status: 'PAID',
                transactionId: null,
              },
              data: { transactionId },
            })
          )
        }
      } else if (status === 'OVERDUE') {
        await withTenantTransaction(context, (tx) =>
          tx.payment.updateMany({
            where: {
              id: payment.id,
              transactionId: transactionId || paymentId,
              tenantId: context.tenantId,
              status: 'PENDING',
            },
            data: {
              status: 'OVERDUE',
              billingStatus: 'UNPAID',
              settledAt: null,
            },
          })
        )
      } else if (status === 'CANCELLED') {
        await withTenantTransaction(context, (tx) =>
          tx.paymentAttempt.updateMany({
            where: {
              tenantId: context.tenantId,
              integrationId: integration.id,
              externalId: transactionId || paymentId,
              paymentId: payment.id,
              status: { in: ['ISSUED', 'OVERDUE'] },
            },
            data: { status: 'CANCELLED' },
          })
        )
      } else if (status === 'REFUNDED') {
        await withTenantTransaction(context, (tx) =>
          tx.payment.updateMany({
            where: {
              id: payment.id,
              tenantId: context.tenantId,
              transactionId: transactionId || paymentId,
              status: 'PAID',
            },
            data: {
              status: 'REFUNDED',
              billingStatus: 'SETTLED',
              settledAt: new Date(),
            },
          })
        )
      }

      return Response.json({
        success: true,
        message: 'Webhook processed successfully',
      })
    } catch (error) {
      console.error('Error processing PIX webhook:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
  return { consumeWebhook }
}
