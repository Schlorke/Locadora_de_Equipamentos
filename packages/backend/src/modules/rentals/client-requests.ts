import type { TenantPrincipal } from '../identity/index'
import { admitRentalCommand } from '../entitlements/command-admission'
import { RentalMutationError } from './errors'
import type { RentalTransaction } from './types'

export type ClientRentalRequestKind = 'PICKUP' | 'EXTENSION'

/**
 * Pedido do cliente (coleta ou prorrogação) registrado para os administradores
 * da locadora ativa, deduplicado pela chave do pedido.
 */
export function createClientRentalRequests({
  withRentalTransaction,
}: {
  withRentalTransaction: RentalTransaction
}) {
  async function requestClientRentalAction(
    principal: TenantPrincipal,
    rentalId: string,
    kind: ClientRentalRequestKind,
    additionalDays?: number
  ) {
    if (
      kind === 'EXTENSION' &&
      (!Number.isInteger(additionalDays) ||
        !additionalDays ||
        additionalDays < 1 ||
        additionalDays > 365)
    ) {
      throw new RentalMutationError('Prazo de prorrogação inválido', 400)
    }
    return withRentalTransaction(principal, async (tx) => {
      const rental = await tx.rentals.findFirst({
        where: {
          id: rentalId,
          tenantId: principal.tenantId,
          userid: principal.userId,
          clientDeletedAt: null,
        },
        include: { rental_items: true },
      })
      if (!rental) throw new RentalMutationError('Locação não encontrada', 404)
      await admitRentalCommand(tx, principal, {})
      if (rental.status !== 'ACTIVE')
        throw new RentalMutationError('Locação deve estar ativa', 400)
      const requestKey = `${kind}:${rentalId}:${additionalDays ?? 0}:${rental.enddate?.toISOString() ?? ''}`
      // Estimativa informativa preservada do contrato legado (não é cobrança).
      const estimatedFee =
        kind === 'EXTENSION'
          ? rental.rental_items.reduce(
              (sum, item) =>
                sum +
                Number(item.priceperday) * additionalDays! * item.quantity,
              0
            )
          : undefined
      const existing = await tx.auditLog.findFirst({
        where: {
          tenantId: principal.tenantId,
          userId: principal.userId,
          action: 'CLIENT_RENTAL_REQUEST',
          entity: 'rental',
          entityId: rentalId,
          changes: { path: ['requestKey'], equals: requestKey },
        },
        select: { id: true },
      })
      if (existing)
        return {
          requestId: existing.id,
          estimatedFee,
          additionalDays,
          duplicate: true,
        }
      const admins = await tx.membership.findMany({
        where: {
          tenantId: principal.tenantId,
          role: 'ADMIN',
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
        },
        select: { userId: true },
      })
      if (!admins.length)
        throw new RentalMutationError(
          'Atendimento da locadora indisponível',
          503
        )
      const record = await tx.auditLog.create({
        data: {
          tenantId: principal.tenantId,
          userId: principal.userId,
          action: 'CLIENT_RENTAL_REQUEST',
          entity: 'rental',
          entityId: rentalId,
          changes: {
            requestKey,
            kind,
            ...(additionalDays ? { additionalDays, estimatedFee } : {}),
          },
        },
        select: { id: true },
      })
      await tx.notification.createMany({
        data: admins.map((admin) => ({
          tenantId: principal.tenantId,
          userId: admin.userId,
          type: 'RENTAL' as const,
          priority: 'HIGH' as const,
          title:
            kind === 'PICKUP'
              ? 'Solicitação de coleta'
              : 'Solicitação de prorrogação',
          message:
            kind === 'PICKUP'
              ? 'Cliente solicitou coleta dos equipamentos.'
              : `Cliente solicitou mais ${additionalDays} dia(s) de locação.`,
          actionUrl: '/admin/rentals',
          metadata: {
            requestId: record.id,
            rentalId,
            requestKey,
            kind,
            ...(additionalDays ? { additionalDays, estimatedFee } : {}),
          },
        })),
      })
      return {
        requestId: record.id,
        estimatedFee,
        additionalDays,
        duplicate: false,
      }
    })
  }
  return { requestClientRentalAction }
}

export type ClientRentalRequests = ReturnType<typeof createClientRentalRequests>
