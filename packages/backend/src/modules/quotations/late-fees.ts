import { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import {
  calculateLateFee,
  DEFAULT_LATE_FEE_CONFIG,
} from '@gb-locacoes/domain/orcamento'
import type { TenantTransactionRunner } from '../rentals/index'

/**
 * Calcula e aplica multas por atraso em lote para orçamentos elegíveis.
 *
 * Regra de negócio:
 * - Considera apenas orçamentos com data de término passada (endDate < hoje)
 * - Status deve ser APPROVED ou COMPLETED
 * - Não sobrescreve multas aprovadas
 * - Apenas grava/atualiza o campo lateFee; aprovação continua manual
 */
export function createQuoteLateFees({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  async function calculateAndApplyLateFees(context: TenantContext) {
    return withTenantTransaction(context, async (tx) => {
      const now = new Date()

      const quotes = await tx.quote.findMany({
        where: {
          tenantId: context.tenantId,
          endDate: {
            lt: now,
          },
          status: {
            in: ['APPROVED', 'COMPLETED'],
          },
          OR: [{ lateFeeApproved: null }, { lateFeeApproved: false }],
        },
        select: {
          id: true,
          total: true,
          originalTotal: true,
          endDate: true,
          lateFee: true,
        },
      })

      let processed = 0
      let updated = 0
      const errors: Array<{ id: string; error: string }> = []

      for (const quote of quotes) {
        processed += 1

        if (!quote.endDate) {
          continue
        }

        try {
          const baseValue = quote.originalTotal
            ? Number(quote.originalTotal)
            : Number(quote.total)

          const result = calculateLateFee(
            baseValue,
            new Date(quote.endDate),
            now,
            DEFAULT_LATE_FEE_CONFIG
          )

          if (result.daysLate <= 0 || result.fee.lte(0)) {
            continue
          }

          const currentLateFee =
            quote.lateFee !== null && quote.lateFee !== undefined
              ? new Prisma.Decimal(quote.lateFee.toString())
              : null

          if (currentLateFee && currentLateFee.eq(result.fee)) {
            continue
          }

          await tx.quote.update({
            where: { id: quote.id, tenantId: context.tenantId },
            data: {
              lateFee: result.fee.toNumber(),
            },
          })

          updated += 1
        } catch (error) {
          errors.push({
            id: quote.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      return {
        processedQuotes: processed,
        updatedQuotes: updated,
        failedQuotes: errors.length,
        errors,
        timestamp: now.toISOString(),
      }
    })
  }
  return { calculateAndApplyLateFees }
}

export type QuoteLateFees = ReturnType<typeof createQuoteLateFees>
