import Decimal from 'decimal.js'
import { BoletoWebhookEventSchema as BoletoEvent } from '@gb-locacoes/contracts/payments'
import type {
  AuthenticatedTenantWebhook,
  createTenantWebhookAuthentication,
} from '../identity/index'
import type { TenantTransactionRunner, QuoteConversion } from '../rentals/index'
import type { createPaymentProcessor } from './payment-processor'
import { parseAsaasWebhook } from './asaas-events'
export function createBoletoWebhookConsumer({
  withTenantTransaction,
  processPayment,
  resolveWebhookResource,
  convertPaidQuotePayment,
}: {
  withTenantTransaction: TenantTransactionRunner
  processPayment: ReturnType<typeof createPaymentProcessor>['processPayment']
  resolveWebhookResource: ReturnType<
    typeof createTenantWebhookAuthentication
  >['resolveWebhookResource']
  convertPaidQuotePayment: QuoteConversion['convertPaidQuotePayment']
}) {
  async function consumeWebhook(authenticated: AuthenticatedTenantWebhook) {
    try {
      const event = BoletoEvent.safeParse(authenticated.body)
      if (!event.success) {
        return Response.json({ error: 'Invalid payload' }, { status: 400 })
      }
      const parsed = parseAsaasWebhook(event.data)

      if (!parsed.transactionId) {
        return Response.json(
          { error: 'transactionId is required' },
          { status: 400 }
        )
      }

      const { context, integration } = authenticated
      const resourceId = await resolveWebhookResource(
        integration,
        'PAYMENT',
        parsed.transactionId
      )
      if (!resourceId)
        return Response.json({ error: 'Payment not found' }, { status: 404 })
      const status = parsed.status
      if (!status) {
        return Response.json(
          { error: 'Status not provided in webhook' },
          { status: 400 }
        )
      }

      const attempt = await withTenantTransaction(context, (tx) =>
        tx.paymentAttempt.findFirst({
          where: {
            tenantId: context.tenantId,
            integrationId: integration.id,
            externalId: parsed.transactionId,
            paymentId: resourceId,
          },
        })
      )
      if (event.data.event === 'PAYMENT_DELETED') {
        if (!attempt)
          return Response.json(
            { error: 'Payment attempt not found' },
            { status: 404 }
          )
        await withTenantTransaction(context, (tx) =>
          tx.paymentAttempt.updateMany({
            where: {
              id: attempt.id,
              tenantId: context.tenantId,
              integrationId: integration.id,
              externalId: parsed.transactionId,
            },
            data: {
              cancellationStatus: 'CONFIRMED',
              cancelledAt: new Date(),
              ...(attempt.status !== 'PAID' && attempt.status !== 'REFUNDED'
                ? { status: 'CANCELLED' as const }
                : {}),
            },
          })
        )
        return Response.json({ success: true })
      }
      const payment = await withTenantTransaction(context, (tx) =>
        tx.payment.findFirst({
          where: {
            id: resourceId,
            tenantId: context.tenantId,
            transactionId: parsed.transactionId,
            method: { in: ['BOLETO', 'PIX'] },
          },
        })
      )

      if (!payment) {
        if (attempt && status === 'paid') {
          if (
            event.data.payment.value === undefined ||
            !new Decimal(String(attempt.amount)).equals(
              event.data.payment.value
            )
          )
            return Response.json(
              { error: 'Payment amount requires reconciliation' },
              { status: 409 }
            )
          await withTenantTransaction(context, async (tx) => {
            const changed = await tx.paymentAttempt.updateMany({
              where: {
                id: attempt.id,
                tenantId: context.tenantId,
                status: { notIn: ['PAID', 'REFUNDED'] },
              },
              data: { status: 'PAID' },
            })
            if (changed.count)
              await tx.auditLog.create({
                data: {
                  tenantId: context.tenantId,
                  action: 'PAYMENT_RECONCILIATION_REQUIRED',
                  entity: 'PaymentAttempt',
                  entityId: attempt.id,
                  changes: {
                    reason: 'PAID_NON_CURRENT_ATTEMPT',
                    paymentId: resourceId,
                  },
                },
              })
          })
          return Response.json({
            success: true,
            reconciliationRequired: true,
          })
        }
        return Response.json({ error: 'Payment not found' }, { status: 404 })
      }

      if (
        status === 'paid' &&
        ['PENDING', 'OVERDUE'].includes(payment.status)
      ) {
        if (
          event.data.payment.value === undefined ||
          !new Decimal(String(payment.amount)).equals(event.data.payment.value)
        )
          return Response.json(
            { error: 'Payment amount requires reconciliation' },
            { status: 409 }
          )
        await processPayment(context, payment.id, {
          status: 'PAID',
          externalId: parsed.transactionId,
          paidAt: parsed.paidAt || new Date(),
        })
        try {
          await convertPaidQuotePayment(context, payment.id)
        } catch (conversionError) {
          console.error('Error converting paid quote payment:', conversionError)
        }
      } else if (status === 'overdue' && payment.status !== 'OVERDUE') {
        await withTenantTransaction(context, (tx) =>
          tx.payment.updateMany({
            where: {
              id: payment.id,
              transactionId: parsed.transactionId,
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
      } else if (status === 'cancelled') {
        if (attempt)
          await withTenantTransaction(context, (tx) =>
            tx.paymentAttempt.updateMany({
              where: {
                id: attempt.id,
                tenantId: context.tenantId,
                status: { in: ['ISSUED', 'OVERDUE'] },
              },
              data: { status: 'CANCELLED' },
            })
          )
      } else if (status === 'refunded' && payment.status !== 'REFUNDED') {
        await withTenantTransaction(context, (tx) =>
          tx.payment.updateMany({
            where: {
              id: payment.id,
              tenantId: context.tenantId,
              transactionId: parsed.transactionId,
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

      return Response.json({ success: true })
    } catch (error) {
      console.error('Error processing boleto webhook:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
  return { consumeWebhook }
}
