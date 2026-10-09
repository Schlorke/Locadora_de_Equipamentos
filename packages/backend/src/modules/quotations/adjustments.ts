import { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { roundToCents } from '@gb-locacoes/domain/locacao'
import {
  quoteObligation,
  quoteObligationResidual,
} from '@gb-locacoes/domain/orcamento'
import type { TenantPrincipal } from '../identity/index'
import { admitRentalCommand } from '../entitlements/command-admission'
import { enqueueOutbox } from '../outbox/index'
import {
  RentalMutationError,
  type RentalTransaction,
  type TenantTransactionRunner,
} from '../rentals/index'
import {
  planBaseCharges,
  preserveLegacyResidual,
  repriceBaseCharges,
} from './base-charges'

const Decimal = Prisma.Decimal

/** Valor gravado ou cobrado em centavos (2 casas, ROUND_HALF_UP), como o provedor cobra. */
const cents = (value: Prisma.Decimal.Value) => new Decimal(roundToCents(value))

/** Reajuste já validado pelo adaptador HTTP. */
export type QuoteAdjustmentInput = {
  category: 'LABOR' | 'TRAVEL' | 'MAINTENANCE' | 'OTHER'
  amount: number
  justification: string
  sendEmail: boolean
  sendWhatsapp: boolean
}

const categoryLabel: Record<string, string> = {
  LABOR: 'Mão de obra',
  TRAVEL: 'Deslocamento (Frete)',
  MAINTENANCE: 'Manutenção',
  OTHER: 'Outro',
}

/**
 * Reajustes do orçamento: o histórico é imutável, o valor final é recalculado
 * pela regra única da obrigação (itens + frete + reajustes vigentes + multa
 * aprovada, sem descartar um valor final legado), a cobrança base pendente
 * nunca emitida passa a cobrar o saldo (valor final menos o já pago) com
 * impostos na mesma transação e a notificação sai pela outbox.
 */
export function createQuoteAdjustments({
  withTenantTransaction,
  withRentalTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
  withRentalTransaction: RentalTransaction
}) {
  /** Reajustes do orçamento, mais recentes primeiro; `null` se o orçamento não é da locadora. */
  async function listQuoteAdjustments(context: TenantContext, id: string) {
    const result = await withTenantTransaction(context, async (tx) => {
      if (
        !(await tx.quote.findFirst({
          where: { id, tenantId: context.tenantId },
          select: { id: true },
        }))
      )
        return null
      return tx.quoteAdjustment.findMany({
        where: { quoteId: id, tenantId: context.tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      })
    })
    return result
      ? result.map((item) => ({
          ...item,
          amount: Number(item.amount),
        }))
      : null
  }

  async function createQuoteAdjustment(
    context: TenantPrincipal,
    id: string,
    payload: QuoteAdjustmentInput
  ) {
    const result = await withRentalTransaction(context, async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id, tenantId: context.tenantId },
        include: { rentals: { select: { id: true } } },
      })
      if (!quote) throw new RentalMutationError('Orçamento não encontrado', 404)
      await admitRentalCommand(tx, context, {})
      if (
        quote.convertedToRentalId ||
        quote.rentals.length ||
        ['COMPLETED', 'REJECTED'].includes(quote.status)
      )
        throw new RentalMutationError(
          'Orçamento convertido ou encerrado requer fluxo de aditivo',
          409,
          'QUOTE_AMENDMENT_REQUIRED'
        )
      // Reajuste em centavos. O de frete (TRAVEL) substitui o frete, que faz parte do total (itens + frete).
      const amount = cents(payload.amount)
      const total =
        payload.category === 'TRAVEL'
          ? cents(
              new Decimal(quote.total.toString())
                .minus(quote.deliveryFee?.toString() ?? 0)
                .plus(amount)
            )
          : quote.total
      const adjustments: Array<{ category: string; amount: Prisma.Decimal }> =
        await tx.quoteAdjustment.findMany({
          where: { quoteId: id, tenantId: context.tenantId },
          select: { category: true, amount: true },
        })
      // Valor final legado que a regra única não explica entra como reajuste vigente (registrado abaixo).
      const residual = new Decimal(
        quoteObligationResidual(quote.finalTotal, {
          total: quote.total,
          adjustments,
          lateFee: quote.lateFee,
          lateFeeApproved: quote.lateFeeApproved,
        }).toString()
      )
      const nextTotal = new Decimal(
        quoteObligation({
          total,
          adjustments: [
            ...adjustments,
            { category: 'OTHER', amount: residual },
            { category: payload.category, amount },
          ],
          lateFee: quote.lateFee,
          lateFeeApproved: quote.lateFeeApproved,
        }).toString()
      )
      // Cobrança base emitida ou vencida exige conciliação antes do reajuste (409, nada gravado);
      // paga fica como está (o saldo é cobrado à parte); a pendente nunca emitida cobra o saldo.
      const plan = await planBaseCharges(
        tx,
        context.tenantId,
        { quoteId: id },
        nextTotal,
        'Cobrança emitida ou paga requer reconciliação antes do reajuste'
      )
      await preserveLegacyResidual(tx, {
        tenantId: context.tenantId,
        quoteId: id,
        userId: context.userId,
        residual,
      })
      const reasonBlock = `[${categoryLabel[payload.category]}] ${payload.justification}`
      const reason = quote.priceAdjustmentReason
        ? `${quote.priceAdjustmentReason}\n${reasonBlock}`
        : reasonBlock
      const adjustment = await tx.quoteAdjustment.create({
        data: {
          tenantId: context.tenantId,
          quoteId: id,
          category: payload.category,
          amount,
          justification: payload.justification,
          createdBy: context.userId,
        },
      })
      const updated = await tx.quote.update({
        where: { id, tenantId: context.tenantId },
        data: {
          originalTotal: quote.originalTotal ?? quote.total,
          finalTotal: nextTotal,
          priceAdjustmentReason: reason,
          priceAdjustedAt: new Date(),
          priceAdjustedBy: context.userId,
          ...(payload.category === 'TRAVEL'
            ? { deliveryFee: amount, total }
            : {}),
        },
      })
      await repriceBaseCharges(tx, context.tenantId, updated, plan)
      await enqueueOutbox(tx, {
        tenantId: context.tenantId,
        topic: 'quote.adjustment.notify',
        aggregateId: id,
        payload: {
          quoteId: id,
          adjustmentId: adjustment.id,
          adjustedAt: updated.priceAdjustedAt!.toISOString(),
          sendEmail: payload.sendEmail,
        },
        dedupeKey: `quote-adjustment:${adjustment.id}`,
      })
      return {
        adjustment,
        quote: {
          id: updated.id,
          quoteCode: updated.quoteCode,
          originalTotal: Number(updated.originalTotal),
          finalTotal: Number(updated.finalTotal),
          priceAdjustmentReason: updated.priceAdjustmentReason,
        },
      }
    })
    return {
      ...result,
      adjustment: {
        ...result.adjustment,
        amount: Number(result.adjustment.amount),
      },
      emailStatus: payload.sendEmail ? 'queued' : 'not_requested',
      whatsappStatus: payload.sendWhatsapp ? 'unavailable' : 'not_requested',
    }
  }

  return { listQuoteAdjustments, createQuoteAdjustment }
}

export type QuoteAdjustments = ReturnType<typeof createQuoteAdjustments>
