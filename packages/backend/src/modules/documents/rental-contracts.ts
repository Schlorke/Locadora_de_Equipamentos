import { integrationCredentialReference } from '../../runtime/index'
import { enqueueOutbox } from '../outbox/index'
import {
  createSubscriptionCommandAccess,
  SubscriptionCommandError,
} from '../entitlements/command-admission'
import type { AccessError } from '@gb-locacoes/contracts/entitlements'
import type { Prisma } from '@prisma/client'
import type { TenantPrincipal } from '../identity/index'
import type { TenantTransactionRunner } from '../rentals/index'
import type { createIntegrationCredentialResolver } from '../../runtime/index'
import { generateContractHTML } from './contract-rendering'

export class ContractAccessError extends Error {
  readonly status: number
  constructor(
    _status: number,
    message: string,
    public readonly policy?: AccessError | { error: string }
  ) {
    super(message)
    this.status = _status
  }
}
async function admitContractCommand(
  tx: Prisma.TransactionClient,
  principal: TenantPrincipal,
  signature = false
) {
  try {
    await createSubscriptionCommandAccess()(
      tx,
      principal,
      signature ? { feature: 'contractSignature' } : {}
    )
  } catch (error) {
    if (!(error instanceof SubscriptionCommandError)) throw error
    throw new ContractAccessError(error.status, error.message, error.body)
  }
}
export function canManageContracts(principal: TenantPrincipal): boolean {
  return ['ADMIN', 'OPERATOR'].includes(principal.role)
}
function contractOwnerFilter(principal: TenantPrincipal) {
  if (canManageContracts(principal)) return {}
  if (principal.role === 'CLIENT') return { userid: principal.userId }
  throw new ContractAccessError(403, 'Acesso negado')
}
async function lockContract(
  tx: Prisma.TransactionClient,
  tenantId: string,
  rentalId: string
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'contract:' + tenantId + ':' + rentalId}, 0))`
}
export function createRentalContracts({
  withTenantTransaction,
  resolveIntegrationCredential,
}: {
  withTenantTransaction: TenantTransactionRunner
  resolveIntegrationCredential: ReturnType<
    typeof createIntegrationCredentialResolver
  >
}) {
  async function generateRentalContract(
    principal: TenantPrincipal,
    rentalId: string
  ) {
    if (!canManageContracts(principal))
      throw new ContractAccessError(403, 'Acesso negado')
    return withTenantTransaction(principal, async (tx) => {
      await lockContract(tx, principal.tenantId, rentalId)
      const rental = await tx.rentals.findFirst({
        where: { id: rentalId, tenantId: principal.tenantId },
        include: { rental_items: { include: { equipments: true } } },
      })
      if (!rental) throw new ContractAccessError(404, 'Locação não encontrada')
      await admitContractCommand(tx, principal)
      const existing = await tx.contract.findFirst({
        where: { tenantId: principal.tenantId, rentalId },
      })
      if (
        existing &&
        (existing.status !== 'DRAFT' ||
          (await tx.contractSignatureAttempt.findFirst({
            where: { tenantId: principal.tenantId, contractId: existing.id },
          })))
      )
        throw new ContractAccessError(
          409,
          'Contrato enviado ou assinado é imutável; uma nova versão exige fluxo específico'
        )
      const client = await tx.clientProfile.findUnique({
        where: {
          tenantId_userId: {
            tenantId: principal.tenantId,
            userId: rental.userid,
          },
        },
      })
      const organization = await tx.organization.findUnique({
        where: { id: principal.tenantId },
        select: { name: true },
      })
      if (!client?.email || !organization)
        throw new ContractAccessError(
          409,
          'Cadastro da locadora ou cliente incompleto'
        )
      const content = generateContractHTML(
        {
          ...rental,
          total: Number(rental.total),
          users: {
            name: client.name,
            email: client.email,
            phone: client.phone,
          },
          rental_items: rental.rental_items.map((item) => ({
            ...item,
            totalprice: Number(item.totalprice),
          })),
        },
        organization.name
      )
      if (existing) {
        const updated = await tx.contract.updateMany({
          where: {
            id: existing.id,
            tenantId: principal.tenantId,
            status: 'DRAFT',
          },
          data: { content, template: 'default' },
        })
        if (updated.count !== 1)
          throw new ContractAccessError(
            409,
            'Contrato alterado durante a operação'
          )
        return tx.contract.findFirstOrThrow({
          where: { id: existing.id, tenantId: principal.tenantId },
        })
      }
      return tx.contract.create({
        data: {
          tenantId: principal.tenantId,
          rentalId,
          content,
          template: 'default',
          status: 'DRAFT',
        },
      })
    })
  }
  async function readRentalContract(
    principal: TenantPrincipal,
    rentalId: string
  ) {
    const ownership = contractOwnerFilter(principal)
    return withTenantTransaction(principal, (tx) =>
      tx.contract.findFirst({
        where: {
          tenantId: principal.tenantId,
          rentalId,
          rental: { tenantId: principal.tenantId, ...ownership },
        },
      })
    )
  }
  async function requestContractSignature(
    principal: TenantPrincipal,
    contractId: string
  ) {
    const ownership = contractOwnerFilter(principal)
    return withTenantTransaction(principal, async (tx) => {
      const contract = await tx.contract.findFirst({
        where: {
          id: contractId,
          tenantId: principal.tenantId,
          rental: { tenantId: principal.tenantId, ...ownership },
        },
      })
      if (!contract)
        throw new ContractAccessError(404, 'Contrato não encontrado')
      await lockContract(tx, principal.tenantId, contract.rentalId)
      const current = await tx.contract.findFirstOrThrow({
        where: {
          id: contractId,
          tenantId: principal.tenantId,
          rental: { tenantId: principal.tenantId, ...ownership },
        },
      })
      await admitContractCommand(tx, principal, true)
      if (current.status !== 'DRAFT' || current.signedAt)
        throw new ContractAccessError(
          409,
          'Contrato não permite nova solicitação de assinatura'
        )
      if (!current.content)
        throw new ContractAccessError(409, 'Conteúdo do contrato ausente')
      const previous = await tx.contractSignatureAttempt.findFirst({
        where: { contractId, tenantId: principal.tenantId },
      })
      if (previous) {
        if (previous.status === 'QUEUED')
          return {
            contract: current,
            queued: true,
            requestId: previous.eventId,
          }
        throw new ContractAccessError(
          409,
          'Solicitação existente requer consulta ou reconciliação'
        )
      }
      const integrations = await tx.tenantIntegration.findMany({
        where: {
          tenantId: principal.tenantId,
          provider: 'ZAPSIGN',
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
        },
      })
      if (integrations.length !== 1)
        throw new ContractAccessError(
          503,
          'Integração de assinatura não configurada'
        )
      const integration = integrations[0]!
      const credential = await resolveIntegrationCredential(
        integrationCredentialReference(integration, tx)
      )
      if (
        !credential?.apiKey ||
        !['sandbox', 'production'].includes(credential.environment || '')
      )
        throw new ContractAccessError(
          503,
          'Credenciais de assinatura indisponíveis'
        )
      const event = await enqueueOutbox(tx, {
        tenantId: principal.tenantId,
        topic: 'contract.signature.request',
        aggregateId: contractId,
        payload: { contractId },
        dedupeKey: `contract-signature:${contractId}`,
      })
      await tx.contractSignatureAttempt.create({
        data: {
          tenantId: principal.tenantId,
          contractId,
          integrationId: integration.id,
          eventId: event.id,
        },
      })
      return { contract: current, queued: true, requestId: event.id }
    })
  }

  return {
    generateRentalContract,
    readRentalContract,
    requestContractSignature,
  }
}
