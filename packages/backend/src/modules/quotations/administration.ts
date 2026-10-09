import type { Prisma } from '@prisma/client'
import { admitRentalCommand } from '../entitlements/command-admission'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import {
  calculateLateFee,
  DEFAULT_LATE_FEE_CONFIG,
  type LateFeeConfig,
} from '@gb-locacoes/domain/orcamento'
import {
  RentalMutationError,
  type RentalTransaction,
  type TenantTransactionRunner,
} from '../rentals/index'

const adminQuoteInclude = {
  items: {
    include: {
      equipment: {
        select: {
          id: true,
          name: true,
          description: true,
          pricePerDay: true,
          images: true,
          category: {
            select: {
              name: true,
              iconColor: true,
              bgColor: true,
              fontColor: true,
            },
          },
        },
      },
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  payments: {
    orderBy: {
      dueDate: 'asc',
    },
  },
} satisfies Prisma.QuoteInclude

/** Entrada já validada pelo adaptador HTTP para a simulação de multa. */
export type QuoteLateFeeInput = {
  currentDate?: string
  config?: LateFeeConfig
}

/** Operações administrativas pontuais sobre orçamentos da locadora ativa. */
export function createQuoteAdministration({
  withTenantTransaction,
  withRentalTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
  withRentalTransaction: RentalTransaction
}) {
  function readAdminQuote(context: TenantContext, id: string) {
    return withTenantTransaction(context, (tx) =>
      tx.quote.findUnique({
        where: { id, tenantId: context.tenantId },
        include: adminQuoteInclude,
      })
    )
  }

  /** Exclui só orçamento sem locação nem cobrança; o histórico financeiro é preservado. */
  async function deleteQuote(context: TenantContext, id: string) {
    await withRentalTransaction(context, async (tx) => {
      await tx.$executeRaw`SELECT id FROM quotes WHERE id = ${id} AND "tenantId" = ${context.tenantId} FOR UPDATE`
      const quote = await tx.quote.findUnique({
        where: { id, tenantId: context.tenantId },
        include: { payments: true, rentals: true },
      })
      if (!quote) throw new RentalMutationError('Orçamento não encontrado', 404)
      await admitRentalCommand(tx, context, {})
      if (
        quote.rentals.length ||
        quote.payments.length ||
        quote.convertedToRentalId
      )
        throw new RentalMutationError(
          'Orçamento com locação ou cobrança deve ser cancelado; histórico não pode ser excluído',
          409
        )
      await tx.quote.delete({ where: { id } })
    })
  }

  /** Simula a multa por atraso do orçamento sem gravar nada. */
  async function calculateQuoteLateFee(
    context: TenantContext,
    id: string,
    input: QuoteLateFeeInput
  ) {
    const quote = await withTenantTransaction(context, (tx) =>
      tx.quote.findFirst({
        where: { tenantId: context.tenantId, id },
        select: { total: true, originalTotal: true, endDate: true },
      })
    )
    if (!quote) return { outcome: 'not_found' as const }
    if (!quote.endDate) return { outcome: 'missing_end_date' as const }
    const calculationDate = input.currentDate
      ? new Date(input.currentDate)
      : new Date()
    const baseValue = Number(quote.originalTotal ?? quote.total)
    const result = calculateLateFee(
      baseValue,
      quote.endDate,
      calculationDate,
      input.config ?? DEFAULT_LATE_FEE_CONFIG
    )
    return {
      outcome: 'calculated' as const,
      lateFee: result.fee.toNumber(),
      daysLate: result.daysLate,
      calculationMethod: result.calculationMethod,
      config: result.config,
      baseValue,
      endDate: quote.endDate,
      calculationDate: calculationDate.toISOString(),
    }
  }

  /** O reajuste existe neste orçamento da locadora (o histórico nunca é excluído). */
  async function hasQuoteAdjustment(
    context: TenantContext,
    quoteId: string,
    adjustmentId: string
  ) {
    const adjustment = await withTenantTransaction(context, (tx) =>
      tx.quoteAdjustment.findFirst({
        where: {
          id: adjustmentId,
          quoteId,
          tenantId: context.tenantId,
        },
        select: { id: true },
      })
    )
    return Boolean(adjustment)
  }

  return {
    readAdminQuote,
    deleteQuote,
    calculateQuoteLateFee,
    hasQuoteAdjustment,
  }
}

export type QuoteAdministration = ReturnType<typeof createQuoteAdministration>
