import type { DeliveryStatus, DeliveryType } from '@prisma/client'
import type {
  DeliveryInput,
  DeliveryPatch,
} from '@gb-locacoes/contracts/operations'
import Decimal from 'decimal.js'
import type { OperationsTransaction } from './types'
import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { RentalMutationError } from '../rentals/errors'
import { admitOperation } from './admission'

export async function assertDeliveryResources(
  context: TenantContext,
  tx: Prisma.TransactionClient,
  refs: { driverId?: string | null; vehicleId?: string | null }
) {
  if (
    refs.driverId &&
    !(await tx.driver.findFirst({
      where: { tenantId: context.tenantId, id: refs.driverId },
      select: { id: true },
    }))
  )
    throw new RentalMutationError('Motorista não encontrado', 404)
  if (
    refs.vehicleId &&
    !(await tx.vehicle.findFirst({
      where: { tenantId: context.tenantId, id: refs.vehicleId },
      select: { id: true },
    }))
  )
    throw new RentalMutationError('Veículo não encontrado', 404)
}
export async function deliveryClientDto<
  T extends { rental: { userid: string | null } },
>(context: TenantContext, tx: Prisma.TransactionClient, deliveries: T[]) {
  const userIds = deliveries
    .map((delivery) => delivery.rental.userid)
    .filter((id): id is string => !!id)
  const profiles = await tx.clientProfile.findMany({
    where: { tenantId: context.tenantId, userId: { in: userIds } },
    select: { userId: true, name: true, email: true, phone: true },
  })
  return deliveries.map((delivery) => {
    const profile = profiles.find(
      (row) => row.userId === delivery.rental.userid
    )
    return {
      ...delivery,
      rental: {
        ...delivery.rental,
        users: profile
          ? {
              id: profile.userId,
              name: profile.name,
              email: profile.email,
              phone: profile.phone,
            }
          : null,
      },
    }
  })
}

export function createDeliveryService({
  withTenantTransaction,
}: {
  withTenantTransaction: OperationsTransaction
}) {
  return {
    listDeliveries(
      context: TenantContext,
      query: {
        status?: string | null
        type?: string | null
        startDate?: string | null
        endDate?: string | null
      }
    ) {
      return withTenantTransaction(context, async (tx) => {
        const where: Prisma.DeliveryWhereInput = { tenantId: context.tenantId }
        if (query.status) where.status = query.status as DeliveryStatus
        if (query.type) where.type = query.type as DeliveryType
        if (query.startDate || query.endDate) {
          where.scheduledAt = {}
          if (query.startDate) where.scheduledAt.gte = new Date(query.startDate)
          if (query.endDate) where.scheduledAt.lte = new Date(query.endDate)
        }
        const deliveries = await tx.delivery.findMany({
          where,
          include: {
            rental: {
              include: {
                rental_items: {
                  include: { equipments: { select: { id: true, name: true } } },
                },
              },
            },
          },
          orderBy: { scheduledAt: 'asc' },
        })
        return deliveryClientDto(context, tx, deliveries)
      })
    },
    createDelivery(
      context: TenantContext,
      input: () => Promise<DeliveryInput>
    ) {
      return withTenantTransaction(context, async (tx) => {
        const data = await input()
        await admitOperation(tx, context, 'logistics')
        const rental = await tx.rentals.findUnique({
          where: { tenantId: context.tenantId, id: data.rentalId },
        })
        if (!rental)
          throw new RentalMutationError('Locação não encontrada', 404)
        await assertDeliveryResources(context, tx, data)
        const delivery = await tx.delivery.create({
          data: {
            tenantId: context.tenantId,
            rentalId: data.rentalId,
            type: data.type,
            scheduledAt: data.scheduledAt,
            address: data.address as Prisma.InputJsonValue,
            distance: data.distance ? new Decimal(data.distance) : null,
            vehicleId: data.vehicleId,
            driverId: data.driverId,
            driverName: data.driverName,
            notes: data.notes,
            status: 'SCHEDULED',
            photos: [],
          },
          include: { rental: true },
        })
        return (await deliveryClientDto(context, tx, [delivery]))[0]
      })
    },
    updateDelivery(
      context: TenantContext,
      id: string,
      input: () => Promise<DeliveryPatch>
    ) {
      return withTenantTransaction(context, async (tx) => {
        const data = await input()
        await admitOperation(tx, context, 'logistics', data)
        const current = await tx.delivery.findFirst({
          where: { tenantId: context.tenantId, id },
        })
        if (!current)
          throw new RentalMutationError('Entrega não encontrada', 404)
        await assertDeliveryResources(context, tx, data)
        const update: Prisma.DeliveryUpdateInput = {}
        if (data.status) update.status = data.status
        if (data.completedAt) update.completedAt = data.completedAt
        if (data.photos) update.photos = data.photos
        if (data.checklist)
          update.checklist = data.checklist as Prisma.InputJsonValue
        if (data.notes !== undefined) update.notes = data.notes
        if (data.vehicleId !== undefined) update.vehicleId = data.vehicleId
        if (data.driverId !== undefined) update.driverId = data.driverId
        if (data.driverName !== undefined) update.driverName = data.driverName
        if (data.distance !== undefined)
          update.distance = data.distance ? new Decimal(data.distance) : null
        if (data.status === 'COMPLETED' && !data.completedAt)
          update.completedAt = new Date()
        const delivery = await tx.delivery.update({
          where: { tenantId: context.tenantId, id },
          data: update,
          include: { rental: true },
        })
        return (await deliveryClientDto(context, tx, [delivery]))[0]
      })
    },
  }
}

export type DeliveryService = ReturnType<typeof createDeliveryService>
