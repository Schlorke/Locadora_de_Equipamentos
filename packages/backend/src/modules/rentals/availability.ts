import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import {
  blocksRentalInventory,
  peakReservedQuantity,
  type ReservationInterval,
} from '@gb-locacoes/domain/locacao'
import { RentalMutationError } from './errors'
import type { TenantTransactionRunner } from './types'

export type AvailabilityReader = Pick<
  Prisma.TransactionClient,
  'equipment' | 'rental_items'
>
export interface AvailabilityOptions {
  db?: AvailabilityReader
  excludeRentalId?: string
}
export interface AvailabilityResult {
  available: boolean
  availableQuantity: number
  totalQuantity: number
  blockedByMaintenance: boolean
  blockedByRentals: number
}
export interface RentalAvailabilityItem extends ReservationInterval {
  equipmentId: string
}

/**
 * Reservas que ocupam o equipamento no período, lidas na conexão informada e
 * sempre filtradas pela locadora explícita (sem cliente implícito).
 */
async function loadReservations(
  db: AvailabilityReader,
  context: TenantContext,
  equipmentId: string,
  startDate: Date,
  endDate: Date,
  excludeRentalId?: string
) {
  if (!context?.tenantId?.trim())
    throw new RentalMutationError(
      'Locadora não selecionada',
      403,
      'tenant_required'
    )
  peakReservedQuantity([], startDate, endDate)
  const equipment = await db.equipment.findFirst({
    where: { id: equipmentId, tenantId: context.tenantId },
    select: { id: true, name: true, maxStock: true, available: true },
  })
  if (!equipment)
    throw new RentalMutationError('Equipamento não encontrado', 404)
  const rentalItems = await db.rental_items.findMany({
    where: {
      equipmentid: equipmentId,
      tenantId: context.tenantId,
      ...(excludeRentalId ? { rentalid: { not: excludeRentalId } } : {}),
      AND: [
        {
          OR: [
            { startDate: { lte: endDate } },
            { startDate: null, rentals: { startdate: { lte: endDate } } },
          ],
        },
        {
          OR: [
            { endDate: { gte: startDate } },
            { endDate: null, rentals: { enddate: { gte: startDate } } },
          ],
        },
      ],
      rentals: {
        tenantId: context.tenantId,
        status: { in: ['PENDING', 'ACTIVE', 'OVERDUE', 'PENDING_RETURN'] },
      },
    },
    include: {
      rentals: {
        select: {
          id: true,
          startdate: true,
          enddate: true,
          status: true,
          total: true,
          payments: {
            where: { tenantId: context.tenantId },
            select: { status: true, type: true, amount: true },
          },
          quote: { select: { status: true, paymentTerms: true } },
        },
      },
    },
  })
  const intervals: ReservationInterval[] = rentalItems
    .filter((item) => blocksRentalInventory(item.rentals))
    .map((item) => ({
      startDate: item.startDate ?? item.rentals.startdate,
      endDate: item.endDate ?? item.rentals.enddate,
      quantity: item.quantity,
    }))
  return {
    equipment,
    intervals,
    maxStock: Math.max(0, equipment.maxStock ?? 1),
  }
}

/** Disponibilidade por locadora. Sem `db`, abre a própria transação tenant. */
export function createRentalAvailability({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  async function calculateEquipmentAvailability(
    context: TenantContext,
    equipmentId: string,
    startDate: Date,
    endDate: Date,
    options: AvailabilityOptions = {}
  ): Promise<AvailabilityResult> {
    const db = options.db
    if (!db)
      return withTenantTransaction(context, (tx) =>
        calculateEquipmentAvailability(
          context,
          equipmentId,
          startDate,
          endDate,
          { ...options, db: tx }
        )
      )
    const { maxStock, intervals } = await loadReservations(
      db,
      context,
      equipmentId,
      startDate,
      endDate,
      options.excludeRentalId
    )
    const blockedByRentals = peakReservedQuantity(intervals, startDate, endDate)
    const availableQuantity = Math.max(0, maxStock - blockedByRentals)
    return {
      available: availableQuantity > 0,
      availableQuantity,
      totalQuantity: maxStock,
      blockedByMaintenance: false,
      blockedByRentals,
    }
  }

  async function isEquipmentAvailableForRental(
    context: TenantContext,
    equipmentId: string,
    startDate: Date,
    endDate: Date,
    requestedQuantity = 1,
    options: AvailabilityOptions = {}
  ): Promise<{ available: boolean; reason?: string }> {
    if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
      return {
        available: false,
        reason: 'Quantidade de equipamentos inválida',
      }
    }
    const availability = await calculateEquipmentAvailability(
      context,
      equipmentId,
      startDate,
      endDate,
      options
    )
    return availability.availableQuantity < requestedQuantity
      ? {
          available: false,
          reason: `Apenas ${availability.availableQuantity} unidade(s) disponível(is). Solicitado: ${requestedQuantity}`,
        }
      : { available: true }
  }

  /** Valida o lote inteiro, inclusive itens repetidos do mesmo equipamento. Chamar sob o lock de mutação. */
  async function assertRentalItemsAvailability(
    context: TenantContext,
    items: readonly RentalAvailabilityItem[],
    options: AvailabilityOptions
  ): Promise<void> {
    const db = options.db
    if (!db)
      return withTenantTransaction(context, (tx) =>
        assertRentalItemsAvailability(context, items, { ...options, db: tx })
      )
    if (items.length === 0)
      throw new RentalMutationError(
        'A locação deve ter ao menos um equipamento'
      )
    const grouped = new Map<string, RentalAvailabilityItem[]>()
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0)
        throw new RentalMutationError('Quantidade de equipamentos inválida')
      if (
        !Number.isFinite(item.startDate.getTime()) ||
        !Number.isFinite(item.endDate.getTime()) ||
        item.endDate < item.startDate
      )
        throw new RentalMutationError('Período de locação inválido')
      grouped.set(item.equipmentId, [
        ...(grouped.get(item.equipmentId) ?? []),
        item,
      ])
    }
    for (const [equipmentId, requested] of grouped) {
      const startDate = new Date(
        Math.min(...requested.map((item) => item.startDate.getTime()))
      )
      const endDate = new Date(
        Math.max(...requested.map((item) => item.endDate.getTime()))
      )
      const { equipment, intervals, maxStock } = await loadReservations(
        db,
        context,
        equipmentId,
        startDate,
        endDate,
        options.excludeRentalId
      )
      if (
        peakReservedQuantity([...intervals, ...requested], startDate, endDate) >
        maxStock
      ) {
        throw new RentalMutationError(
          `Equipamento ${equipment.name}: estoque insuficiente no período solicitado`,
          409,
          'stock_unavailable'
        )
      }
    }
  }

  function calculateEquipmentCalendarAvailability(
    context: TenantContext,
    equipmentId: string,
    startDate: Date,
    endDate: Date
  ) {
    return withTenantTransaction(context, async (tx) => {
      const { maxStock, intervals } = await loadReservations(
        tx,
        context,
        equipmentId,
        startDate,
        endDate
      )
      const availability: Record<
        string,
        {
          available: boolean
          availableQuantity: number
          totalQuantity: number
        }
      > = {}
      for (
        const day = new Date(startDate);
        day <= endDate;
        day.setUTCDate(day.getUTCDate() + 1)
      ) {
        const dayEnd = new Date(day)
        dayEnd.setUTCHours(23, 59, 59, 999)
        const occupied = peakReservedQuantity(intervals, day, dayEnd)
        const availableQuantity = Math.max(0, maxStock - occupied)
        availability[day.toISOString().slice(0, 10)] = {
          available: availableQuantity > 0,
          availableQuantity,
          totalQuantity: maxStock,
        }
      }
      return { availability, maxStock }
    })
  }

  return {
    calculateEquipmentAvailability,
    isEquipmentAvailableForRental,
    assertRentalItemsAvailability,
    calculateEquipmentCalendarAvailability,
  }
}

export type RentalAvailability = ReturnType<typeof createRentalAvailability>
