import { integrationCredentialReference } from '../../runtime/index'
import type { PaymentMethod, Prisma } from '@prisma/client'
import { enqueueOutbox } from '../outbox/index'
import {
  findUnverifiedCancelledCharges,
  withCancelledChargeProof,
} from './cancelled-charges'
import type { TenantPrincipal } from '../identity/index'
import type { RentalTransaction } from '../rentals/index'
import { PaymentRequestError } from './payment-errors'
import {
  cancelledChargeError,
  resolvePaymentObligation,
  type PaymentReference,
  type BillingCredentialResolver,
} from './payment-obligation'
import type { ProviderChargeReader } from './cancelled-charges'
import {
  createSubscriptionCommandAccess,
  SubscriptionCommandError,
} from '../entitlements/command-admission'
import {
  assertReceivingAccountReady,
  ReceivingAccountNotReadyError,
} from './receiving-account-readiness'
async function lockObligation(
  tx: Prisma.TransactionClient,
  principal: TenantPrincipal,
  input: PaymentReference
) {
  const key =
    principal.tenantId + ':payment:' + (input.rentalId ?? input.quoteId ?? '')
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
}
export function createPaymentRequests({
  withRentalTransaction,
  readTenantProviderCharge,
  resolveIntegrationCredential,
}: {
  withRentalTransaction: RentalTransaction
  readTenantProviderCharge: ProviderChargeReader
  resolveIntegrationCredential: BillingCredentialResolver
}) {
  async function requestPayment(
    principal: TenantPrincipal,
    input: PaymentReference & { dueDate: Date },
    method: Extract<PaymentMethod, 'PIX' | 'BOLETO'>
  ) {
    return withCancelledChargeProof({
      context: principal,
      transaction: (operation) => withRentalTransaction(principal, operation),
      lock: (tx) => lockObligation(tx, principal, input),
      reader: readTenantProviderCharge,
      failure: cancelledChargeError,
      prepare: async (tx) => {
        await lockObligation(tx, principal, input)
        const obligation = await resolvePaymentObligation(tx, input, principal)
        try {
          await createSubscriptionCommandAccess()(tx, principal, {
            feature: 'onlinePayments',
            payment: input,
          })
        } catch (error) {
          if (!(error instanceof SubscriptionCommandError)) throw error
          throw new PaymentRequestError(error.status, error.message, error.body)
        }
        // Before the integration is selected: a subaccount not yet approved answers 409, never "not configured".
        try {
          await assertReceivingAccountReady(tx, principal.tenantId)
        } catch (error) {
          if (!(error instanceof ReceivingAccountNotReadyError)) throw error
          throw new PaymentRequestError(error.status, error.message, error.body)
        }
        const integrations = await tx.tenantIntegration.findMany({
          where: {
            tenantId: principal.tenantId,
            provider: 'ASAAS',
            status: 'ACTIVE',
          },
        })
        if (integrations.length !== 1)
          throw new PaymentRequestError(
            503,
            'Integração de cobrança da locadora não configurada'
          )
        const integration = integrations[0]!
        const credential = await resolveIntegrationCredential(
          integrationCredentialReference(integration, tx)
        )
        if (
          !credential?.apiKey ||
          !['sandbox', 'production'].includes(credential.environment ?? '')
        ) {
          throw new PaymentRequestError(
            503,
            'Integração de cobrança da locadora não configurada'
          )
        }
        const existing = await tx.payment.findFirst({
          where: {
            ...obligation.reference,
            tenantId: principal.tenantId,
            type: { in: ['RENTAL', 'DEPOSIT'] },
            status: { in: ['PENDING', 'OVERDUE'] },
          },
          orderBy: { createdAt: 'desc' },
        })
        if (existing && existing.method !== method)
          throw new PaymentRequestError(
            409,
            'Já existe uma cobrança pendente por outro meio de pagamento'
          )
        if (existing && !existing.amount.equals(obligation.amount))
          throw new PaymentRequestError(
            409,
            'A cobrança existente exige ajuste e conciliação'
          )
        if (!existing) {
          // CANCELLED só no sistema não prova que a cobrança morreu no provedor.
          const cancelled = await tx.payment.findMany({
            where: {
              ...obligation.reference,
              tenantId: principal.tenantId,
              type: { in: ['RENTAL', 'DEPOSIT'] },
              status: 'CANCELLED',
              transactionId: { not: null },
            },
            orderBy: { createdAt: 'desc' },
          })
          const unverified = await findUnverifiedCancelledCharges(
            tx,
            principal,
            cancelled
          )
          if (unverified.length)
            return { kind: 'verify' as const, rows: unverified }
        }
        const payment =
          existing ??
          (await tx.payment.create({
            data: {
              ...obligation.reference,
              tenantId: principal.tenantId,
              amount: obligation.amount,
              type: obligation.type,
              method,
              status: 'PENDING',
              dueDate: input.dueDate,
            },
          }))
        if (!payment.transactionId) {
          await tx.paymentAttempt.upsert({
            where: {
              idempotencyKey:
                principal.tenantId + ':payment:' + payment.id + ':initial',
            },
            create: {
              tenantId: principal.tenantId,
              paymentId: payment.id,
              integrationId: integration.id,
              provider: 'ASAAS',
              idempotencyKey:
                principal.tenantId + ':payment:' + payment.id + ':initial',
              amount: payment.amount,
              dueDate: payment.dueDate,
            },
            update: {},
          })
          await enqueueOutbox(tx, {
            tenantId: principal.tenantId,
            topic: 'payment.issue',
            aggregateId: payment.id,
            payload: { paymentId: payment.id },
            dedupeKey: 'payment.issue:' + payment.id,
          })
        }
        return {
          kind: 'ready' as const,
          value: { payment, pending: !payment.transactionId },
        }
      },
    })
  }
  return { requestPayment }
}
