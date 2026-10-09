import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { randomUUID } from 'node:crypto'
import { Prisma, RentalStatus } from '@prisma/client'
import {
  blocksRentalInventory,
  hasCheckoutPayment,
  roundToCents,
  type MoneyValue,
} from '@gb-locacoes/domain/locacao'
import { enqueueOutbox } from '../outbox/index'
import type { RentalAvailability } from './availability'
import { RentalMutationError } from './errors'
import { assertTenantCustomer } from './transaction'
import type { DecimalValue, RentalTransaction } from './types'
import { admitRentalCommand } from '../entitlements/command-admission'

const Decimal = Prisma.Decimal

/** Valor gravado ou cobrado em centavos (2 casas, ROUND_HALF_UP), como o provedor cobra. */
const cents = (value: MoneyValue) => new Decimal(roundToCents(value))

export const rentalResponseInclude = {
  users: { select: { id: true, name: true, email: true } },
  rental_items: {
    include: { equipments: { select: { id: true, name: true } } },
  },
} satisfies Prisma.rentalsInclude

/** Filtro de status vindo da URL: valor fora do enum não casa nenhuma locação. */
export function rentalStatusFilter(
  value: string
): Prisma.rentalsWhereInput['status'] {
  return (Object.values(RentalStatus) as string[]).includes(value)
    ? (value as RentalStatus)
    : { in: [] }
}

/** Documentos obrigatórios ausentes, lidos na transação informada (API pública de customers). */
export type MissingClientDocuments = (
  _context: TenantContext,
  _options: { userId: string; rentalId?: string | null },
  _db: Prisma.TransactionClient
) => Promise<readonly string[]>

export type ManualRentalInput = {
  userId: string
  startDate: Date
  endDate: Date
  notes?: string
  items: Array<{
    equipmentId: string
    quantity: number
    days: number
    pricePerDay: DecimalValue
  }>
}

export type RentalUpdateInput = {
  status?: RentalStatus
  startDate?: Date
  endDate?: Date
  extensionDays?: number
  lateFee?: DecimalValue
  checkInAt?: Date
  checkOutAt?: Date
  notes?: string
}

export type RentalExtensionInput = {
  additionalDays: number
  customerId?: string
  generateBoleto?: boolean
  boletoDueDate?: Date
}

const stateInclude = {
  rental_items: true,
  payments: true,
  quote: true,
} satisfies Prisma.rentalsInclude
type RentalState = Prisma.rentalsGetPayload<{ include: typeof stateInclude }>

async function readRental(
  context: TenantContext,
  tx: Prisma.TransactionClient,
  id: string
) {
  const rental = await tx.rentals.findFirst({
    where: { id, tenantId: context.tenantId },
    include: {
      ...stateInclude,
      rental_items: { where: { tenantId: context.tenantId } },
      payments: { where: { tenantId: context.tenantId } },
    },
  })
  if (!rental) throw new RentalMutationError('Locação não encontrada', 404)
  if (rental.quote && rental.quote.tenantId !== context.tenantId)
    throw new RentalMutationError('Vínculo de orçamento fora da locadora', 409)
  await assertTenantCustomer(tx, context, rental.userid)
  return rental
}

function rentalItems(rental: RentalState) {
  return rental.rental_items.map((item) => ({
    equipmentId: item.equipmentid,
    quantity: item.quantity,
    startDate: item.startDate ?? rental.startdate,
    endDate: item.endDate ?? rental.enddate,
  }))
}

/**
 * Ciclo de vida da locação (criação manual, check-out, alteração, prorrogação
 * e check-in). Toda mutação roda em `withRentalTransaction` e revalida o
 * estoque com a mesma conexão e o mesmo lock.
 */
export function createRentalLifecycle({
  withRentalTransaction,
  assertRentalItemsAvailability,
  getMissingClientDocuments,
}: {
  withRentalTransaction: RentalTransaction
  assertRentalItemsAvailability: RentalAvailability['assertRentalItemsAvailability']
  getMissingClientDocuments: MissingClientDocuments
}) {
  async function assertCheckout(
    context: TenantContext,
    tx: Prisma.TransactionClient,
    rental: RentalState
  ) {
    if (rental.status !== 'PENDING')
      throw new RentalMutationError(
        'Locação deve estar pendente para fazer check-out'
      )
    if (rental.quote?.status === 'REJECTED')
      throw new RentalMutationError(
        'Orçamento rejeitado não pode sair para locação'
      )
    if (!hasCheckoutPayment(rental))
      throw new RentalMutationError(
        'Pagamento ainda não confirmado para retirada'
      )
    const missing = await getMissingClientDocuments(
      context,
      { userId: rental.userid, rentalId: rental.id },
      tx
    )
    if (missing.length)
      throw new RentalMutationError(
        `Fechamento bloqueado: faltam documentos obrigatórios (${missing.join(', ')}).`,
        400,
        'missing_documents',
        missing
      )
    await assertRentalItemsAvailability(context, rentalItems(rental), {
      db: tx,
      excludeRentalId: rental.id,
    })
  }

  function checkoutRental(context: TenantContext, id: string) {
    return withRentalTransaction(context, async (tx) => {
      const rental = await readRental(context, tx, id)
      await admitRentalCommand(tx, context, {})
      if (rental.status === 'ACTIVE' && rental.checkOutAt)
        return tx.rentals.findUniqueOrThrow({
          where: { id, tenantId: context.tenantId },
          include: rentalResponseInclude,
        })
      await assertCheckout(context, tx, rental)
      return tx.rentals.update({
        where: { id, tenantId: context.tenantId },
        data: { status: 'ACTIVE', checkOutAt: new Date() },
        include: rentalResponseInclude,
      })
    })
  }

  function createManualRental(
    context: TenantContext,
    input: ManualRentalInput
  ) {
    return withRentalTransaction(context, async (tx) => {
      await assertTenantCustomer(tx, context, input.userId)
      await admitRentalCommand(tx, context, {})
      await assertRentalItemsAvailability(
        context,
        input.items.map((item) => ({
          ...item,
          startDate: input.startDate,
          endDate: input.endDate,
        })),
        { db: tx }
      )
      if (
        input.items.some(
          (item) =>
            !item.pricePerDay.isFinite() ||
            item.pricePerDay.isNegative() ||
            !Number.isInteger(item.days) ||
            item.days <= 0
        )
      )
        throw new RentalMutationError('Preço inválido')
      // Totais em centavos na origem: o total da locação é o valor cobrado.
      const itemTotals = input.items.map((item) =>
        cents(item.pricePerDay.times(item.days).times(item.quantity))
      )
      const total = itemTotals.reduce(
        (sum, itemTotal) => sum.plus(itemTotal),
        new Decimal(0)
      )
      return tx.rentals.create({
        data: {
          tenantId: context.tenantId,
          id: `rental_${randomUUID()}`,
          userid: input.userId,
          startdate: input.startDate,
          enddate: input.endDate,
          total,
          status: 'PENDING',
          notes: input.notes,
          rental_items: {
            create: input.items.map((item, index) => ({
              tenantId: context.tenantId,
              id: `rental_item_${randomUUID()}`,
              equipmentid: item.equipmentId,
              quantity: item.quantity,
              priceperday: item.pricePerDay,
              totaldays: item.days,
              totalprice: itemTotals[index]!,
              startDate: input.startDate,
              endDate: input.endDate,
            })),
          },
        },
        include: {
          ...rentalResponseInclude,
          contract: {
            select: { id: true, status: true, signedAt: true, pdfUrl: true },
          },
        },
      })
    })
  }

  function updateRental(
    context: TenantContext,
    id: string,
    input: RentalUpdateInput
  ) {
    return withRentalTransaction(context, async (tx) => {
      const rental = await readRental(context, tx, id)
      await admitRentalCommand(tx, context, { rentalClose: input })
      const changedStatus = input.status && input.status !== rental.status
      if (['COMPLETED', 'CANCELLED'].includes(rental.status) && changedStatus)
        throw new RentalMutationError(
          'Locação encerrada não pode ser reaberta',
          409
        )
      if (changedStatus && input.status === 'PENDING')
        throw new RentalMutationError('Locação não pode voltar a pendente', 409)
      if (
        changedStatus &&
        ['ACTIVE', 'OVERDUE', 'PENDING_RETURN'].includes(input.status!) &&
        rental.status === 'PENDING' &&
        input.status !== 'ACTIVE'
      )
        throw new RentalMutationError(
          'Realize o check-out antes de alterar o estado da locação',
          409
        )
      if (input.checkOutAt && !rental.checkOutAt && input.status !== 'ACTIVE')
        throw new RentalMutationError('Registro de saída exige check-out', 409)
      const checkout = changedStatus && input.status === 'ACTIVE'
      const items = rentalItems(rental).map((item) => {
        const endDate = input.endDate ?? item.endDate
        const extended = new Date(endDate)
        if (input.extensionDays)
          extended.setDate(extended.getDate() + input.extensionDays)
        return {
          ...item,
          startDate: input.startDate ?? item.startDate,
          endDate: extended,
        }
      })
      const datesChanged = Boolean(
        input.startDate || input.endDate || input.extensionDays
      )
      if (datesChanged) {
        if (['COMPLETED', 'CANCELLED'].includes(rental.status))
          throw new RentalMutationError(
            'Datas de locação encerrada não podem ser alteradas',
            409
          )
        await assertRentalItemsAvailability(context, items, {
          db: tx,
          excludeRentalId: id,
        })
        for (let index = 0; index < items.length; index++) {
          await tx.rental_items.update({
            where: {
              id: rental.rental_items[index]!.id,
              tenantId: context.tenantId,
            },
            data: {
              startDate: items[index]!.startDate,
              endDate: items[index]!.endDate,
            },
          })
        }
      }
      if (checkout) {
        const checkoutState = datesChanged
          ? await readRental(context, tx, id)
          : rental
        await assertCheckout(context, tx, checkoutState)
      } else if (
        changedStatus &&
        blocksRentalInventory({ ...rental, status: input.status! })
      ) {
        await assertRentalItemsAvailability(context, items, {
          db: tx,
          excludeRentalId: id,
        })
      }
      return tx.rentals.update({
        where: { id, tenantId: context.tenantId },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(datesChanged
            ? {
                startdate: new Date(
                  Math.min(...items.map((item) => item.startDate.getTime()))
                ),
                enddate: new Date(
                  Math.max(...items.map((item) => item.endDate.getTime()))
                ),
              }
            : {}),
          ...(input.extensionDays !== undefined
            ? {
                extensionDays:
                  (rental.extensionDays ?? 0) + input.extensionDays,
              }
            : {}),
          ...(input.lateFee !== undefined
            ? { lateFee: cents(input.lateFee) }
            : {}),
          ...(input.checkInAt ? { checkInAt: input.checkInAt } : {}),
          ...(checkout ? { checkOutAt: new Date() } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        include: rentalResponseInclude,
      })
    })
  }

  function extendRental(
    context: TenantContext,
    id: string,
    input: RentalExtensionInput
  ) {
    return withRentalTransaction(context, async (tx) => {
      const rental = await readRental(context, tx, id)
      if (input.customerId && rental.userid !== input.customerId)
        throw new RentalMutationError('Locação não encontrada', 404)
      await admitRentalCommand(tx, context, {})
      const allowed = input.customerId ? ['ACTIVE', 'OVERDUE'] : ['ACTIVE']
      if (!allowed.includes(rental.status))
        throw new RentalMutationError(
          'Locação não pode ser prorrogada neste estado',
          409
        )
      const items = rentalItems(rental).map((item) => {
        const endDate = new Date(item.endDate)
        endDate.setDate(endDate.getDate() + input.additionalDays)
        return { ...item, endDate }
      })
      await assertRentalItemsAvailability(context, items, {
        db: tx,
        excludeRentalId: id,
      })
      // Taxa em centavos antes de gravar e cobrar: o priceperday de um orçamento
      // convertido é fracionário (unitTotal/dias) e o provedor cobra em centavos.
      const extensionFee = cents(
        input.customerId
          ? new Decimal(rental.total.toString())
              .div(
                Math.max(
                  1,
                  Math.ceil(
                    (rental.enddate.getTime() - rental.startdate.getTime()) /
                      86400000
                  )
                )
              )
              .times(input.additionalDays)
              .times('0.1')
          : rental.rental_items.reduce(
              (sum, item) =>
                sum.plus(
                  new Decimal(item.priceperday.toString())
                    .times(input.additionalDays)
                    .times(item.quantity)
                ),
              new Decimal(0)
            )
      )
      for (let index = 0; index < items.length; index++)
        await tx.rental_items.update({
          where: {
            id: rental.rental_items[index]!.id,
            tenantId: context.tenantId,
          },
          data: { endDate: items[index]!.endDate },
        })
      const updated = await tx.rentals.update({
        where: { id, tenantId: context.tenantId },
        data: {
          enddate: new Date(
            Math.max(...items.map((item) => item.endDate.getTime()))
          ),
          extensionDays: (rental.extensionDays ?? 0) + input.additionalDays,
          extensionFee: new Decimal(rental.extensionFee?.toString() ?? 0).plus(
            extensionFee
          ),
        },
      })
      const payment =
        extensionFee.gt(0) && (input.customerId || input.generateBoleto)
          ? await tx.payment.create({
              data: {
                tenantId: context.tenantId,
                rentalId: id,
                amount: extensionFee,
                grossAmount: extensionFee,
                netAmount: extensionFee,
                method: input.customerId ? 'PIX' : 'BOLETO',
                status: 'PENDING',
                billingStatus: 'AWAITING_PAYMENT',
                type: 'LATE_FEE',
                dueDate:
                  input.boletoDueDate ??
                  (input.customerId
                    ? new Date()
                    : new Date(Date.now() + 3 * 86400000)),
                metadata: { extensionDays: input.additionalDays },
              },
            })
          : null
      if (payment?.method === 'BOLETO')
        await enqueueOutbox(tx, {
          tenantId: context.tenantId,
          topic: 'payment.boleto.issue',
          aggregateId: payment.id,
          payload: { paymentId: payment.id },
          dedupeKey: `payment-boleto:${payment.id}`,
        })
      return {
        rental: updated,
        paymentId: payment?.id,
        extensionFee: extensionFee.toNumber(),
      }
    })
  }

  function checkinRental(
    context: TenantContext,
    id: string,
    input: { damageFee?: number; notes?: string }
  ) {
    return withRentalTransaction(context, async (tx) => {
      const rental = await readRental(context, tx, id)
      await admitRentalCommand(tx, context, { rentalReturn: input })
      if (!['ACTIVE', 'OVERDUE', 'PENDING_RETURN'].includes(rental.status))
        throw new RentalMutationError('Locação não está em uso', 409)
      const now = new Date()
      const daysLate = Math.max(
        0,
        Math.ceil((now.getTime() - rental.enddate.getTime()) / 86400000)
      )
      // Multa e avaria em centavos antes de gravar e cobrar.
      const lateFee =
        daysLate > 0
          ? cents(
              new Decimal(rental.total.toString())
                .div(
                  rental.rental_items.reduce(
                    (sum, item) => sum + item.totaldays,
                    0
                  ) || 1
                )
                .times('0.1')
                .times(daysLate)
            )
          : null
      const updated = await tx.rentals.update({
        where: { id, tenantId: context.tenantId },
        data: {
          status: 'COMPLETED',
          checkInAt: now,
          lateFee,
          notes: input.notes ?? rental.notes,
        },
      })
      for (const fee of [
        { amount: lateFee, type: 'LATE_FEE' as const },
        {
          amount: input.damageFee ? cents(input.damageFee) : null,
          type: 'DAMAGE' as const,
        },
      ]) {
        if (fee.amount?.gt(0))
          await tx.payment.create({
            data: {
              tenantId: context.tenantId,
              rentalId: id,
              amount: fee.amount,
              method: 'BOLETO',
              status: 'PENDING',
              type: fee.type,
              dueDate: new Date(now.getTime() + 3 * 86400000),
            },
          })
      }
      return {
        rental: updated,
        lateFee: lateFee?.toNumber() ?? null,
        damageFee: input.damageFee || null,
      }
    })
  }

  return {
    checkoutRental,
    createManualRental,
    updateRental,
    extendRental,
    checkinRental,
  }
}

export type RentalLifecycle = ReturnType<typeof createRentalLifecycle>
