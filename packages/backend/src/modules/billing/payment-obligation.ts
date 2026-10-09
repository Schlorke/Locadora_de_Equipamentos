import Decimal from 'decimal.js'
import { integrationCredentialReference, type IntegrationCredentialReference } from '../../runtime/index'
import type { Prisma } from '@prisma/client'
import { obligationBalance } from '@gb-locacoes/domain/locacao'
import type { TenantPrincipal } from '../identity/index'
import type { TenantTransactionRunner } from '../rentals/index'
import { BillingProviderError } from './asaas-http'
import { createAsaasGateway } from './asaas'
import {
  CANCELLED_CHARGE_FAILURES,
  type CancelledChargeFailure,
  type ProviderChargeRead,
} from './cancelled-charges'
import { PaymentRequestError } from './payment-errors'
export type BillingCredentialResolver = (
  _ref: IntegrationCredentialReference
) => Promise<{ apiKey?: string; environment?: string } | null>
export interface PaymentReference {
  rentalId?: string
  quoteId?: string
  amount: number
}

export function cancelledChargeError(
  failure: CancelledChargeFailure
): PaymentRequestError {
  const { status, message } = CANCELLED_CHARGE_FAILURES[failure]
  return new PaymentRequestError(status, message)
}
export async function resolvePaymentObligation(
  tx: Prisma.TransactionClient,
  input: PaymentReference,
  actor: TenantPrincipal
) {
  if (Boolean(input.rentalId) === Boolean(input.quoteId)) {
    throw new PaymentRequestError(
      400,
      'Informe exatamente um orçamento ou uma locação'
    )
  }
  const canManage =
    actor.role === 'ADMIN' ||
    (actor.role !== 'CLIENT' &&
      Boolean(
        await tx.permission.findFirst({
          where: {
            tenantId: actor.tenantId,
            role: actor.role,
            module: 'FINANCIAL',
            action: 'WRITE',
          },
        })
      ))
  const rental = input.rentalId
    ? await tx.rentals.findFirst({
        where: { id: input.rentalId, tenantId: actor.tenantId },
      })
    : null
  const quote = input.quoteId
    ? await tx.quote.findFirst({
        where: { id: input.quoteId, tenantId: actor.tenantId },
      })
    : null
  const ownerId = rental?.userid ?? quote?.userId
  if ((!rental && !quote) || (!canManage && ownerId !== actor.userId)) {
    throw new PaymentRequestError(404, 'Obrigação não encontrada')
  }
  if (rental && ['CANCELLED', 'COMPLETED'].includes(rental.status)) {
    throw new PaymentRequestError(409, 'Locação não permite nova cobrança')
  }
  if (
    quote &&
    (!quote.approvedAt ||
      quote.status === 'REJECTED' ||
      quote.convertedToRentalId)
  ) {
    throw new PaymentRequestError(409, 'Orçamento não permite nova cobrança')
  }
  const reference = rental ? { rentalId: rental.id } : { quoteId: quote!.id }
  const total = rental ? rental.total : (quote?.finalTotal ?? quote?.total ?? 0)
  const paid = await tx.payment.aggregate({
    where: {
      ...reference,
      tenantId: actor.tenantId,
      type: { in: ['RENTAL', 'DEPOSIT'] },
      status: 'PAID',
    },
    _sum: { amount: true },
  })
  // Saldo em centavos pela regra única de quitação (a mesma de isObligationSettled e da conversão).
  const amount = obligationBalance(total, [paid._sum.amount ?? 0])
  if (amount.lte(0)) throw new PaymentRequestError(409, 'Obrigação já quitada')
  if (!amount.equals(new Decimal(input.amount)))
    throw new PaymentRequestError(
      400,
      'Valor informado diverge do saldo da obrigação'
    )
  const profile = ownerId
    ? await tx.clientProfile.findFirst({
        where: { tenantId: actor.tenantId, userId: ownerId },
      })
    : null
  const name = profile?.name ?? quote?.name
  const email = profile?.email ?? quote?.email
  const document = profile?.document ?? quote?.cpf ?? quote?.cnpj
  if (!name || !email || !document)
    throw new PaymentRequestError(
      409,
      'Cadastro do titular nesta locadora incompleto'
    )
  return {
    amount,
    customer: { name, email, document },
    reference,
    description: rental ? 'Locação ' + rental.id : 'Orçamento ' + quote!.id,
    type: rental ? ('RENTAL' as const) : ('DEPOSIT' as const),
  }
}
export function createTenantProviderChargeReader({
  withTenantTransaction,
  resolveIntegrationCredential,
}: {
  withTenantTransaction: TenantTransactionRunner
  resolveIntegrationCredential: BillingCredentialResolver
}) {
  async function readTenantProviderCharge(
    context: { tenantId: string },
    externalId: string
  ): Promise<ProviderChargeRead> {
    const integrations = await withTenantTransaction(context, (tx) =>
      tx.tenantIntegration.findMany({
        where: {
          tenantId: context.tenantId,
          provider: 'ASAAS',
          status: 'ACTIVE',
        },
        select: { id: true, credentialsRef: true, credentialSource: true, tenantId: true, provider: true, environment: true },
      })
    )
    const integration = integrations.length === 1 ? integrations[0] : undefined
    if (!integration)
      throw new BillingProviderError('UNAVAILABLE', {
        reason: 'INVALID_CONFIGURATION',
      })
    const credential = await resolveIntegrationCredential(
      integrationCredentialReference(integration)
    )
    const environment = credential?.environment
    if (
      !credential?.apiKey ||
      (environment !== 'sandbox' && environment !== 'production')
    ) {
      throw new BillingProviderError('UNAVAILABLE', {
        reason: 'MISSING_CREDENTIAL',
      })
    }
    const charge = await createAsaasGateway({
      apiKey: credential.apiKey,
      environment,
    }).get(externalId)
    return { integrationId: integration.id, charge }
  }
  return { readTenantProviderCharge }
}
