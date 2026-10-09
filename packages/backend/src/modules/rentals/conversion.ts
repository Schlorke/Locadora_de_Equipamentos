import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { admitRentalCommand } from '../entitlements/command-admission'
import { randomUUID } from 'node:crypto'
import { Prisma, type RentalStatus } from '@prisma/client'
import { getBoletoDueDate } from '@gb-locacoes/domain/pagamento'
import {
  isObligationSettled,
  obligationBalance,
  roundToCents,
} from '@gb-locacoes/domain/locacao'
import { enqueueOutbox } from '../outbox/index'
import type { RentalAvailability } from './availability'
import { RentalMutationError } from './errors'
import { assertTenantCustomer } from './transaction'
import type { RentalTransaction, TenantTransactionRunner } from './types'

const Decimal = Prisma.Decimal

export interface ConvertQuoteToRentalResult {
  rentalId: string
  paymentId?: string
  boletoGenerated: boolean
}

export type PaidQuoteConversionResult = {
  converted: boolean
  rentalId?: string
  reason?: string
}

function findQuoteRental(
  context: TenantContext,
  tx: Prisma.TransactionClient,
  quoteId: string
) {
  return tx.rentals.findFirst({
    where: { quoteId, tenantId: context.tenantId },
    orderBy: { createdat: 'asc' },
  })
}

/** Idempotência: a conversão repetida devolve a locação já vinculada ao orçamento. */
async function reuseQuoteRental(
  context: TenantContext,
  tx: Prisma.TransactionClient,
  quoteId: string,
  existing: { id: string; status: RentalStatus }
) {
  if (existing.status === 'CANCELLED')
    throw new RentalMutationError(
      'A locação deste orçamento foi cancelada',
      409,
      'rental_cancelled'
    )
  await tx.payment.updateMany({
    where: { quoteId, tenantId: context.tenantId },
    data: { rentalId: existing.id, quoteId: null },
  })
  await tx.quote.update({
    where: { id: quoteId, tenantId: context.tenantId },
    data: { status: 'COMPLETED', convertedToRentalId: existing.id },
  })
  return existing.id
}

/**
 * Conversão de orçamento em locação. A conversão roda sob o lock de mutação
 * da locadora e trava o orçamento (`FOR UPDATE`) antes de qualquer decisão;
 * nenhum efeito externo roda na transação SQL (só eventos da outbox).
 */
export function createQuoteConversion({
  withTenantTransaction,
  withRentalTransaction,
  assertRentalItemsAvailability,
}: {
  withTenantTransaction: TenantTransactionRunner
  withRentalTransaction: RentalTransaction
  assertRentalItemsAvailability: RentalAvailability['assertRentalItemsAvailability']
}) {
  /** Caller must hold the rental mutation lock; no external effects run in this transaction. */
  async function convertInTransaction(
    context: TenantContext,
    tx: Prisma.TransactionClient,
    quoteId: string,
    manual: boolean
  ) {
    // Também coordena com os updates legados do orçamento que ainda não usam o advisory lock.
    await tx.$executeRaw`SELECT id FROM quotes WHERE id = ${quoteId} AND "tenantId" = ${context.tenantId} FOR UPDATE`
    const quote = await tx.quote.findFirst({
      where: { id: quoteId, tenantId: context.tenantId },
      include: {
        items: { where: { tenantId: context.tenantId } },
        payments: { where: { tenantId: context.tenantId } },
        user: true,
      },
    })
    if (!quote)
      throw new RentalMutationError(
        'Orçamento não encontrado',
        404,
        'quote_not_found'
      )
    if (quote.status === 'REJECTED')
      throw new RentalMutationError(
        'Orçamento rejeitado não pode ser convertido',
        400,
        'quote_not_approved'
      )
    if (manual) await admitRentalCommand(tx, context, {})

    const existing = await findQuoteRental(context, tx, quoteId)
    if (existing)
      return {
        rentalId: await reuseQuoteRental(context, tx, quoteId, existing),
        quote,
      }
    if (quote.convertedToRentalId)
      throw new RentalMutationError(
        'Vínculo de locação inconsistente; requer reconciliação',
        409,
        'rental_link_inconsistent'
      )

    // Quitação sobre as cobranças vigentes: CANCELLED/REFUNDED ficam no histórico sem bloquear.
    const allPaid = isObligationSettled(
      quote.finalTotal ?? quote.total,
      quote.payments
    )
    const approved =
      quote.status === 'APPROVED' ||
      (quote.status === 'PENDING' && Boolean(quote.approvedAt) && allPaid)
    if (!approved)
      throw new RentalMutationError(
        'Orçamento deve estar aprovado para ser convertido',
        400,
        'quote_not_approved'
      )
    if (quote.paymentTerms !== 'AT_END' && !allPaid) {
      throw new RentalMutationError(
        'Pagamento ainda não confirmado para reservar o orçamento',
        400,
        'pending_payments'
      )
    }
    if (!quote.userId)
      throw new RentalMutationError(
        'Orçamento deve ter cliente vinculado',
        400,
        'missing_customer'
      )

    const items = quote.items.map((item) => {
      const startDate = item.startDate ?? quote.startDate
      const endDate = item.endDate ?? quote.endDate
      if (!startDate || !endDate)
        throw new RentalMutationError(
          'Orçamento deve ter datas de início e fim definidas por item'
        )
      return { ...item, startDate, endDate }
    })
    await assertTenantCustomer(tx, context, quote.userId)
    await assertRentalItemsAvailability(context, items, { db: tx })
    const startDate = new Date(
      Math.min(...items.map((item) => item.startDate.getTime()))
    )
    const endDate = new Date(
      Math.max(...items.map((item) => item.endDate.getTime()))
    )
    // Obrigação em centavos: o total da locação é o mesmo valor que o provedor cobra.
    const total = new Decimal(roundToCents(quote.finalTotal ?? quote.total))
    const userId = quote.userId
    let rental: { id: string }
    try {
      // Savepoint: a violação de rentals_tenant_quote_unique não aborta a transação do chamador.
      rental = await tx.$transaction((savepoint) =>
        savepoint.rentals.create({
          data: {
            tenantId: context.tenantId,
            id: `rental_${randomUUID()}`,
            userid: userId,
            quoteId,
            startdate: startDate,
            enddate: endDate,
            total,
            status: 'PENDING',
            notes: quote.internalNotes ?? quote.adminNotes,
            rental_items: {
              create: items.map((item) => ({
                tenantId: context.tenantId,
                id: `rental_item_${randomUUID()}`,
                equipmentid: item.equipmentId,
                quantity: item.quantity,
                priceperday: item.pricePerDay,
                totaldays: item.days,
                totalprice: item.total,
                startDate: item.startDate,
                endDate: item.endDate,
                includeWeekends: item.includeWeekends,
              })),
            },
          },
          select: { id: true },
        })
      )
    } catch (error) {
      // Um escritor concorrente venceu o índice único: reaproveita a locação dele.
      const concurrent =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
          ? await findQuoteRental(context, tx, quoteId)
          : null
      if (!concurrent) throw error
      return {
        rentalId: await reuseQuoteRental(context, tx, quoteId, concurrent),
        quote,
      }
    }
    await tx.payment.updateMany({
      where: { quoteId, tenantId: context.tenantId },
      data: { rentalId: rental.id, quoteId: null },
    })
    await tx.quote.update({
      where: { id: quoteId, tenantId: context.tenantId },
      data: { status: 'COMPLETED', convertedToRentalId: rental.id },
    })
    await enqueueOutbox(tx, {
      tenantId: context.tenantId,
      topic: 'quote.status.notify',
      aggregateId: quote.id,
      payload: { quoteId: quote.id, status: 'COMPLETED' },
      dedupeKey: `quote-converted:${rental.id}`,
    })
    return { rentalId: rental.id, quote }
  }

  /** Accepted effects and a caller that already admitted its command share the same core. */
  function convertQuoteToRentalInTransaction(
    context: TenantContext,
    tx: Prisma.TransactionClient,
    quoteId: string
  ) {
    return convertInTransaction(context, tx, quoteId, false)
  }

  async function performConversion(
    context: TenantContext,
    quoteId: string,
    options: { generateBoleto?: boolean; boletoDueDate?: Date } | undefined,
    manual: boolean
  ): Promise<ConvertQuoteToRentalResult> {
    return withRentalTransaction(context, async (tx) => {
      const result = await convertInTransaction(context, tx, quoteId, manual)
      if (options?.generateBoleto) {
        const payments = await tx.payment.findMany({
          where: {
            rentalId: result.rentalId,
            tenantId: context.tenantId,
            type: { in: ['RENTAL', 'DEPOSIT'] },
          },
        })
        // Saldo em centavos pela regra única de quitação (isObligationSettled/resolvePaymentObligation).
        const amount = new Decimal(
          obligationBalance(
            result.quote.finalTotal ?? result.quote.total,
            payments
              .filter((payment) => payment.status === 'PAID')
              .map((payment) => payment.amount)
          )
        )
        if (amount.gt(0)) {
          const pending = payments.find(
            (payment) =>
              payment.method === 'BOLETO' &&
              ['PENDING', 'OVERDUE'].includes(payment.status)
          )
          const payment =
            pending ??
            (await tx.payment.create({
              data: {
                tenantId: context.tenantId,
                rentalId: result.rentalId,
                amount,
                grossAmount: amount,
                netAmount: amount,
                method: 'BOLETO',
                type: 'RENTAL',
                status: 'PENDING',
                billingStatus: 'AWAITING_PAYMENT',
                dueDate:
                  options.boletoDueDate ?? getBoletoDueDate(new Date(), 3),
              },
            }))
          if (!payment.transactionId)
            await enqueueOutbox(tx, {
              tenantId: context.tenantId,
              topic: 'payment.boleto.issue',
              aggregateId: payment.id,
              payload: { paymentId: payment.id },
              dedupeKey: `payment-boleto:${payment.id}`,
            })
          return {
            rentalId: result.rentalId,
            paymentId: payment.id,
            boletoGenerated: false,
          }
        }
      }
      return { rentalId: result.rentalId, boletoGenerated: false }
    })
  }

  function convertQuoteToRental(
    context: TenantContext,
    quoteId: string,
    options?: { generateBoleto?: boolean; boletoDueDate?: Date }
  ) {
    return performConversion(context, quoteId, options, true)
  }

  /** Conversão disparada por pagamento confirmado; falhas de regra viram `converted: false`. */
  async function convertPaidQuotePayment(
    context: TenantContext,
    paymentId: string
  ): Promise<PaidQuoteConversionResult> {
    const payment = await withTenantTransaction(context, (tx) =>
      tx.payment.findFirst({
        where: { id: paymentId, tenantId: context.tenantId },
        include: { rental: { select: { id: true, quoteId: true } } },
      })
    )
    if (!payment) return { converted: false, reason: 'no_quote' }
    if (payment.status !== 'PAID')
      return { converted: false, reason: 'payment_not_paid' }
    const quoteId = payment.quoteId ?? payment.rental?.quoteId
    if (!quoteId) return { converted: false, reason: 'no_quote' }
    try {
      const result = await performConversion(
        context,
        quoteId,
        {
          generateBoleto: false,
        },
        false
      )
      return { converted: true, rentalId: result.rentalId }
    } catch (error) {
      if (
        error instanceof RentalMutationError &&
        ['quote_not_found', 'quote_not_approved', 'pending_payments'].includes(
          error.code
        )
      ) {
        return { converted: false, reason: error.code }
      }
      throw error
    }
  }

  /**
   * Execução agendada por locadora: orçamentos aprovados há mais de uma hora e
   * ainda sem locação são convertidos a partir da primeira cobrança paga. Falha
   * de um orçamento é registrada e não interrompe os demais.
   */
  async function autoConvertApprovedQuotes(context: TenantContext) {
    const approvedQuotes = await withTenantTransaction(context, (tx) =>
      tx.quote.findMany({
        where: {
          tenantId: context.tenantId,
          status: 'APPROVED',
          convertedToRentalId: null,
          approvedAt: {
            lte: new Date(Date.now() - 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
        },
      })
    )

    const results = {
      converted: 0,
      errors: [] as string[],
    }

    for (const quote of approvedQuotes) {
      try {
        const paidPayment = await withTenantTransaction(context, (tx) =>
          tx.payment.findFirst({
            where: {
              tenantId: context.tenantId,
              quoteId: quote.id,
              status: 'PAID',
            },
            orderBy: { createdAt: 'asc' },
          })
        )

        if (!paidPayment) {
          continue
        }

        const conversion = await convertPaidQuotePayment(
          context,
          paidPayment.id
        )
        if (conversion.converted) {
          results.converted++
        }
      } catch (error) {
        console.error(`Error converting quote ${quote.id}:`, error)
        results.errors.push(
          `Quote ${quote.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return { processed: approvedQuotes.length, results }
  }

  return {
    convertQuoteToRental,
    convertQuoteToRentalInTransaction,
    convertPaidQuotePayment,
    autoConvertApprovedQuotes,
  }
}

export type QuoteConversion = ReturnType<typeof createQuoteConversion>
