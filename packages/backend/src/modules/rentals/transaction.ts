import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { RentalMutationError } from './errors'
import type { RentalTransaction, TenantTransactionRunner } from './types'

/** One lock identity shared by inventory mutations and publication eligibility. */
export async function lockTenantRentalMutations(
  tx: Prisma.TransactionClient,
  tenantId: string
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gb-locacoes:rental-mutations'), hashtext(${tenantId}))`
}

/** Todas as decisões e escritas de reserva usam a mesma conexão e o mesmo lock. */
export function createRentalTransaction({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}): { withRentalTransaction: RentalTransaction } {
  function withRentalTransaction<T>(
    context: TenantContext,
    operation: (_tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    if (!context?.tenantId?.trim())
      throw new RentalMutationError(
        'Locadora não selecionada',
        403,
        'tenant_required'
      )
    return withTenantTransaction(context, async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: context.tenantId },
        select: { status: true },
      })
      if (!organization || organization.status !== 'ACTIVE')
        throw new RentalMutationError(
          'Locadora indisponível',
          403,
          'tenant_inactive'
        )
      await lockTenantRentalMutations(tx, context.tenantId)
      return operation(tx)
    })
  }
  return { withRentalTransaction }
}

export async function assertTenantCustomer(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  userId: string
) {
  const membership = await tx.membership.findFirst({
    where: {
      tenantId: context.tenantId,
      userId,
      role: 'CLIENT',
      status: 'ACTIVE',
    },
  })
  if (!membership)
    throw new RentalMutationError(
      'Cliente não pertence à locadora ativa',
      404,
      'customer_not_found'
    )
}
