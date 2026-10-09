import {
  integrationCredentialReference,
  type IntegrationCredentialReference,
} from '../../runtime/index'
import type { Prisma } from '@prisma/client'
import { cancelAttempt } from './cancel-attempt'
import { createAsaasGateway } from './asaas'
import { enqueueOutbox, PermanentDeliveryError } from '../outbox/index'
import { getBoletoDueDate } from '@gb-locacoes/domain/pagamento'
import { PaymentRequestError } from './payment-errors'
import type { TenantPrincipal } from '../identity/index'
import type { RentalTransaction } from '../rentals/index'
import type { ProcessPaymentOptions } from './payment-processor'
import {
  createSubscriptionCommandAccess,
  SubscriptionCommandError,
} from '../entitlements/command-admission'
type Context = { tenantId: string }
function payloadOf(payload: unknown): {
  paymentId: string
  attemptId: string
  dueDate: string
} {
  if (!payload || typeof payload !== 'object')
    throw new PermanentDeliveryError('INVALID_PAYLOAD')
  const value = payload as Record<string, unknown>
  if (
    typeof value.paymentId !== 'string' ||
    !value.paymentId ||
    typeof value.attemptId !== 'string' ||
    !value.attemptId ||
    typeof value.dueDate !== 'string' ||
    !Number.isFinite(Date.parse(value.dueDate))
  ) {
    throw new PermanentDeliveryError('INVALID_PAYLOAD')
  }
  return {
    paymentId: value.paymentId,
    attemptId: value.attemptId,
    dueDate: value.dueDate,
  }
}
async function lock(
  tx: Prisma.TransactionClient,
  context: Context,
  paymentId: string
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId + ':issue:' + paymentId}, 0))`
}

export function createBoletoReissueRequest({
  withRentalTransaction,
}: {
  withRentalTransaction: RentalTransaction
}) {
  async function requestBoletoReissue(
    principal: TenantPrincipal,
    paymentId: string,
    options: { dueDate?: Date } = {}
  ) {
    return withRentalTransaction(principal, async (tx) => {
      await lock(tx, principal, paymentId)
      const payment = await tx.payment.findFirst({
        where: {
          id: paymentId,
          tenantId: principal.tenantId,
          method: 'BOLETO',
        },
      })
      if (!payment)
        throw new PaymentRequestError(404, 'Pagamento não encontrado')
      if (!['PENDING', 'OVERDUE'].includes(payment.status))
        throw new PaymentRequestError(
          409,
          'Pagamento confirmado ou encerrado não pode ser reemitido'
        )
      try {
        await createSubscriptionCommandAccess()(tx, principal, {
          reissuePaymentId: paymentId,
        })
      } catch (error) {
        if (!(error instanceof SubscriptionCommandError)) throw error
        throw new PaymentRequestError(error.status, error.message, error.body)
      }
      if (!payment.transactionId)
        throw new PaymentRequestError(
          409,
          'Aguarde a conclusão da emissão atual'
        )
      const attempt = await tx.paymentAttempt.findFirst({
        where: {
          tenantId: principal.tenantId,
          paymentId,
          externalId: payment.transactionId,
        },
        include: { integration: true },
      })
      if (
        !attempt ||
        !['ISSUED', 'OVERDUE'].includes(attempt.status) ||
        !attempt.integration ||
        attempt.integration.tenantId !== principal.tenantId ||
        attempt.integration.status !== 'ACTIVE'
      ) {
        throw new PaymentRequestError(
          409,
          'A cobrança exige conciliação antes da reemissão'
        )
      }
      const dueDate = options.dueDate ?? getBoletoDueDate()
      if (
        !Number.isFinite(dueDate.getTime()) ||
        dueDate.getTime() < Date.now() - 86400000
      )
        throw new PaymentRequestError(400, 'Vencimento inválido')
      const event = await enqueueOutbox(tx, {
        tenantId: principal.tenantId,
        topic: 'payment.boleto.reissue',
        aggregateId: paymentId,
        payload: {
          paymentId,
          attemptId: attempt.id,
          dueDate: dueDate.toISOString(),
          requestedBy: principal.userId,
        },
        dedupeKey: 'payment.boleto.reissue:' + attempt.id,
      })
      if (
        options.dueDate &&
        event.payload &&
        typeof event.payload === 'object' &&
        !Array.isArray(event.payload) &&
        event.payload.dueDate !== dueDate.toISOString()
      )
        throw new PaymentRequestError(
          409,
          'Já existe uma reemissão pendente com outro vencimento'
        )
      if (event.status === 'FAILED')
        throw new PaymentRequestError(
          409,
          'A reemissão exige conciliação manual'
        )
      await tx.paymentAttempt.updateMany({
        where: {
          id: attempt.id,
          tenantId: principal.tenantId,
          cancellationStatus: 'NONE',
        },
        data: {
          cancellationStatus: 'REQUESTED',
          cancellationRequestedAt: new Date(),
        },
      })
      return {
        paymentId,
        processing: 'PENDING' as const,
        operationId: event.id,
      }
    })
  }

  return { requestBoletoReissue }
}
export function createBoletoReissueWorker({
  withRentalTransaction,
  resolveIntegrationCredential,
  processPayment,
}: {
  withRentalTransaction: RentalTransaction
  resolveIntegrationCredential: (
    _ref: IntegrationCredentialReference
  ) => Promise<{ apiKey?: string; environment?: string } | null>
  processPayment: (
    _context: Context,
    _paymentId: string,
    _options: ProcessPaymentOptions
  ) => Promise<void>
}) {
  async function runBoletoReissue(context: Context, payload: unknown) {
    const input = payloadOf(payload)
    const prepared = await withRentalTransaction(context, async (tx) => {
      const attempt = await tx.paymentAttempt.findFirst({
        where: {
          id: input.attemptId,
          tenantId: context.tenantId,
          paymentId: input.paymentId,
        },
        include: { payment: true, integration: true },
      })
      if (
        !attempt ||
        !attempt.externalId ||
        !attempt.integration ||
        attempt.integration.status !== 'ACTIVE' ||
        attempt.integration.tenantId !== context.tenantId
      )
        throw new PermanentDeliveryError('ATTEMPT_NOT_AVAILABLE')
      if (['PAID', 'REFUNDED', 'CANCELLED'].includes(attempt.payment.status))
        return null
      if (attempt.payment.transactionId !== attempt.externalId) {
        const replacement = await tx.paymentAttempt.findUnique({
          where: {
            idempotencyKey:
              context.tenantId +
              ':payment:' +
              input.paymentId +
              ':reissue:' +
              attempt.id,
          },
        })
        if (replacement) return null
        throw new PermanentDeliveryError('ATTEMPT_REQUIRES_REVIEW')
      }
      return attempt
    })
    if (!prepared) return
    const credential = await resolveIntegrationCredential(
      integrationCredentialReference(prepared.integration!)
    )
    if (
      !credential?.apiKey ||
      (credential.environment !== 'sandbox' &&
        credential.environment !== 'production')
    ) {
      throw new Error('BILLING_INTEGRATION_UNAVAILABLE')
    }
    await cancelAttempt(
      {
        load: async () => ({
          id: prepared.id,
          externalId: prepared.externalId!,
          reference: prepared.idempotencyKey,
          amount: prepared.amount.toNumber(),
          state: prepared.cancellationStatus,
        }),
        claim: (id) =>
          withRentalTransaction(context, async (tx) => {
            await lock(tx, context, input.paymentId)
            const current = await tx.payment.findFirst({
              where: {
                tenantId: context.tenantId,
                id: input.paymentId,
                transactionId: prepared.externalId,
                status: { in: ['PENDING', 'OVERDUE'] },
              },
            })
            if (!current) return false
            const changed = await tx.paymentAttempt.updateMany({
              where: {
                id,
                tenantId: context.tenantId,
                cancellationStatus: 'REQUESTED',
              },
              data: { cancellationStatus: 'PROCESSING' },
            })
            return changed.count === 1
          }),
        unknown: async (id) => {
          await withRentalTransaction(context, (tx) =>
            tx.paymentAttempt.updateMany({
              where: {
                id,
                tenantId: context.tenantId,
                cancellationStatus: 'PROCESSING',
              },
              data: { cancellationStatus: 'UNKNOWN' },
            })
          )
        },
        // DELETE provado não aplicado (429, 401, interruptor…): volta a REQUESTED e a outbox tenta de novo.
        release: async (id) => {
          await withRentalTransaction(context, (tx) =>
            tx.paymentAttempt.updateMany({
              where: {
                id,
                tenantId: context.tenantId,
                cancellationStatus: 'PROCESSING',
              },
              data: { cancellationStatus: 'REQUESTED' },
            })
          )
        },
        paid: async () => {
          await processPayment(context, input.paymentId, {
            status: 'PAID',
            externalId: prepared.externalId!,
          })
        },
        confirmed: async (id) => {
          await withRentalTransaction(context, async (tx) => {
            await lock(tx, context, input.paymentId)
            const key =
              context.tenantId +
              ':payment:' +
              input.paymentId +
              ':reissue:' +
              id
            if (
              await tx.paymentAttempt.findUnique({
                where: { idempotencyKey: key },
              })
            )
              return
            const payment = await tx.payment.findFirst({
              where: { id: input.paymentId, tenantId: context.tenantId },
            })
            if (
              !payment ||
              !['PENDING', 'OVERDUE'].includes(payment.status) ||
              payment.transactionId !== prepared.externalId
            ) {
              throw new PermanentDeliveryError(
                'PAYMENT_RECONCILIATION_REQUIRED'
              )
            }
            const cancelled = await tx.paymentAttempt.updateMany({
              where: {
                id,
                tenantId: context.tenantId,
                status: { in: ['ISSUED', 'OVERDUE', 'CANCELLED'] },
              },
              data: {
                status: 'CANCELLED',
                cancellationStatus: 'CONFIRMED',
                cancelledAt: new Date(),
                response: {
                  ...(prepared.response &&
                  typeof prepared.response === 'object' &&
                  !Array.isArray(prepared.response)
                    ? prepared.response
                    : {}),
                  previousPaymentMetadata: payment.metadata ?? {},
                },
              },
            })
            if (cancelled.count !== 1)
              throw new PermanentDeliveryError(
                'PAYMENT_RECONCILIATION_REQUIRED'
              )
            const next = await tx.paymentAttempt.create({
              data: {
                tenantId: context.tenantId,
                paymentId: payment.id,
                integrationId: prepared.integrationId,
                provider: prepared.provider,
                idempotencyKey: key,
                amount: payment.amount,
                dueDate: new Date(input.dueDate),
              },
            })
            const metadata: Record<
              string,
              Prisma.InputJsonValue | null | undefined
            > =
              payment.metadata &&
              typeof payment.metadata === 'object' &&
              !Array.isArray(payment.metadata)
                ? { ...payment.metadata }
                : {}
            for (const field of [
              'barcode',
              'digitableLine',
              'pdfUrl',
              'boletoSentAt',
              'boletoSentBy',
              'boletoSentEmail',
            ])
              delete metadata[field]
            await tx.payment.updateMany({
              where: { id: payment.id, tenantId: context.tenantId },
              data: {
                transactionId: null,
                pixCode: null,
                pixQrCode: null,
                status: 'PENDING',
                billingStatus: 'AWAITING_PAYMENT',
                dueDate: next.dueDate,
                boletoIssuedAt: null,
                metadata,
              },
            })
            await enqueueOutbox(tx, {
              tenantId: context.tenantId,
              topic: 'payment.issue',
              aggregateId: payment.id,
              payload: { paymentId: payment.id },
              dedupeKey: 'payment.issue:' + next.id,
            })
          })
        },
      },
      createAsaasGateway({
        apiKey: credential.apiKey,
        environment: credential.environment,
      })
    )
  }

  return { runBoletoReissue }
}
