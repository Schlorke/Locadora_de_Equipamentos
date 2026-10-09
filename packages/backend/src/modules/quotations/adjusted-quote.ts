import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { enqueueOutbox } from '../outbox/index'
import { admitRentalCommand } from '../entitlements/command-admission'
import { RentalMutationError, type RentalTransaction } from '../rentals/index'

/**
 * Envio do orçamento ajustado ao cliente: exige ajuste vigente e enfileira a
 * notificação durável (deduplicada pelo instante do ajuste) na mesma
 * transação; o e-mail sai pela outbox, fora do SQL.
 */
export function createAdjustedQuoteDelivery({
  withRentalTransaction,
}: {
  withRentalTransaction: RentalTransaction
}) {
  async function requestAdjustedQuoteDelivery(
    context: TenantContext,
    id: string
  ): Promise<void> {
    await withRentalTransaction(context, async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id, tenantId: context.tenantId },
      })
      if (!quote) throw new RentalMutationError('Orçamento não encontrado', 404)
      await admitRentalCommand(tx, context, {})
      if (
        quote.status === 'REJECTED' ||
        !quote.priceAdjustmentReason?.trim() ||
        quote.finalTotal === null ||
        !quote.priceAdjustedAt
      )
        throw new RentalMutationError(
          'Orçamento não possui ajuste vigente para envio',
          409
        )
      await enqueueOutbox(tx, {
        tenantId: context.tenantId,
        topic: 'quote.adjustment.notify',
        aggregateId: id,
        payload: {
          quoteId: id,
          adjustedAt: quote.priceAdjustedAt.toISOString(),
          sendEmail: true,
        },
        dedupeKey: `quote-adjustment-send:${id}:${quote.priceAdjustedAt.toISOString()}`,
      })
    })
  }
  return { requestAdjustedQuoteDelivery }
}

export type AdjustedQuoteDelivery = ReturnType<
  typeof createAdjustedQuoteDelivery
>
