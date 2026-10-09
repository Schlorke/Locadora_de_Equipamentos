import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'

/**
 * Marca orçamentos pendentes com validade vencida da locadora informada. O
 * enum não tem EXPIRED: o orçamento continua PENDING com nota interna.
 */
export function createQuoteExpiration({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  async function checkAndExpireQuotes(context: TenantContext) {
    return withTenantTransaction(context, async (tx) => {
      try {
        const now = new Date()

        // Buscar orçamentos pendentes com validUntil no passado
        const expiredQuotes = await tx.quote.findMany({
          where: {
            tenantId: context.tenantId,
            status: 'PENDING',
            validUntil: {
              lt: now,
            },
          },
        })

        // Como não temos enum EXPIRED, o orçamento recebe uma nota interna
        for (const quote of expiredQuotes) {
          await tx.quote.update({
            where: { id: quote.id, tenantId: context.tenantId },
            data: {
              internalNotes: quote.internalNotes
                ? `${quote.internalNotes}\n[EXPIRADO] Orçamento expirado em ${now.toISOString()}`
                : `[EXPIRADO] Orçamento expirado em ${now.toISOString()}`,
              updatedAt: now,
            },
          })
        }

        return {
          expiredCount: expiredQuotes.length,
          expiredIds: expiredQuotes.map((q) => q.id),
        }
      } catch (error) {
        console.error('Error checking and expiring quotes:', error)
        throw error
      }
    })
  }
  return { checkAndExpireQuotes }
}

export type QuoteExpiration = ReturnType<typeof createQuoteExpiration>
