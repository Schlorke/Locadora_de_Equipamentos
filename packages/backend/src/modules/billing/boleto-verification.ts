import { integrationCredentialReference } from '../../runtime/index'
import { readAsaasPayment } from './asaas-events'
import type { createIntegrationCredentialResolver } from '../../runtime/index'
import type { TenantPrincipal } from '../identity/index'
import type { Prisma } from '@prisma/client'
import type { RentalTransaction, QuoteConversion } from '../rentals/index'
import type { createPaymentProcessor } from './payment-processor'
type VerificationTransaction = <T>(
  _context: { tenantId: string },
  _operation: (_tx: Prisma.TransactionClient) => Promise<T>,
  _options?: { timeout?: number; maxWait?: number }
) => Promise<T>
export function createTenantBoletoVerifier({
  withTenantTransaction,
  resolveIntegrationCredential,
  readPayment = readAsaasPayment,
}: {
  withTenantTransaction: VerificationTransaction
  resolveIntegrationCredential: ReturnType<
    typeof createIntegrationCredentialResolver
  >
  readPayment?: typeof readAsaasPayment
}) {
  async function verifyTenantBoleto(
    context: { tenantId: string },
    payment: { id: string; transactionId: string }
  ) {
    const reference = await withTenantTransaction(
      context,
      (tx) =>
        tx.externalResourceTenant.findFirst({
          where: {
            tenantId: context.tenantId,
            provider: 'ASAAS',
            resourceType: 'PAYMENT',
            resourceId: payment.id,
            externalId: payment.transactionId,
          },
          include: { integration: true },
        }),
      { timeout: 5000, maxWait: 3000 }
    )
    if (
      !reference ||
      reference.integration.tenantId !== context.tenantId ||
      reference.integration.status !== 'ACTIVE'
    )
      throw new Error('Payment integration unavailable')
    const credential = await resolveIntegrationCredential(
      integrationCredentialReference(reference.integration)
    )
    if (
      !credential?.apiKey ||
      !['sandbox', 'production'].includes(credential.environment || '')
    )
      throw new Error('Payment integration credentials unavailable')
    return readPayment(payment.transactionId, {
      apiKey: credential.apiKey,
      environment:
        credential.environment === 'production' ? 'production' : 'sandbox',
    })
  }
  return { verifyTenantBoleto }
}
export function createBoletoVerificationService({
  withTenantTransaction,
  withRentalTransaction,
  verifyTenantBoleto,
  processPayment,
  convertPaidQuotePayment,
}: {
  withTenantTransaction: VerificationTransaction
  withRentalTransaction: RentalTransaction
  verifyTenantBoleto: ReturnType<
    typeof createTenantBoletoVerifier
  >['verifyTenantBoleto']
  processPayment: ReturnType<typeof createPaymentProcessor>['processPayment']
  convertPaidQuotePayment: QuoteConversion['convertPaidQuotePayment']
}) {
  async function verifyBoletoPayment(
    principal: TenantPrincipal,
    paymentId: string
  ): Promise<Response> {
    const payment = await withTenantTransaction(principal, (tx) =>
      tx.payment.findFirst({
        where: {
          id: paymentId,
          tenantId: principal.tenantId,
          method: 'BOLETO',
        },
      })
    )
    if (!payment)
      return Response.json(
        { error: 'Pagamento não encontrado' },
        { status: 404 }
      )
    if (!payment.transactionId)
      return Response.json({ processing: 'PENDING', payment }, { status: 202 })
    const verification = await verifyTenantBoleto(principal, {
      id: payment.id,
      transactionId: payment.transactionId,
    })
    const status = {
      paid: 'PAID',
      overdue: 'OVERDUE',
      cancelled: 'CANCELLED',
      refunded: 'REFUNDED',
      pending: 'PENDING',
    } as const
    if (
      verification.amount !== undefined &&
      !payment.amount.equals(verification.amount)
    )
      return Response.json(
        { error: 'Valor divergente exige conciliação' },
        { status: 409 }
      )
    if (verification.status === 'cancelled') {
      await withRentalTransaction(principal, (tx) =>
        tx.paymentAttempt.updateMany({
          where: {
            tenantId: principal.tenantId,
            paymentId: payment.id,
            externalId: payment.transactionId,
            status: { notIn: ['PAID', 'REFUNDED'] },
          },
          data: {
            status: 'CANCELLED',
            cancellationStatus: 'CONFIRMED',
            cancelledAt: new Date(),
          },
        })
      )
    } else {
      await processPayment(principal, payment.id, {
        status: status[verification.status],
        paidAt: verification.paidAt,
        externalId: payment.transactionId,
      })
    }
    if (verification.status === 'paid')
      await convertPaidQuotePayment(principal, payment.id)
    const updated = await withTenantTransaction(principal, (tx) =>
      tx.payment.findFirst({
        where: { id: payment.id, tenantId: principal.tenantId },
      })
    )
    return Response.json({ payment: updated, verification })
  }
  return { verifyBoletoPayment }
}
