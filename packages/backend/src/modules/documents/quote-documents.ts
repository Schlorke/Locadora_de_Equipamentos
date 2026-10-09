import type { TenantPrincipal } from '../identity/index'
import type { TenantTransactionRunner } from '../rentals/index'
import { renderQuotePdf } from './quote-pdf'
import { renderQuoteAdjustmentPdf } from './quote-adjustment-pdf'
export function createQuoteDocuments({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  async function generateQuoteDocument(
    principal: TenantPrincipal,
    quoteId: string,
    audience: 'admin' | 'client',
    adjustments = false
  ) {
    const snapshot = await withTenantTransaction(principal, async (tx) => {
      const quote = await tx.quote.findFirst({
        where: {
          id: quoteId,
          tenantId: principal.tenantId,
          ...(audience === 'client'
            ? { userId: principal.userId, clientDeletedAt: null }
            : {}),
        },
        include: {
          items: {
            where: { tenantId: principal.tenantId },
            include: { equipment: { select: { name: true } } },
          },
          adjustments: {
            where: { tenantId: principal.tenantId },
            orderBy: { createdAt: 'desc' },
          },
        },
      })
      if (!quote) return null
      const issuer = await tx.organization.findFirst({
        where: { id: principal.tenantId, status: 'ACTIVE' },
        select: { name: true, document: true },
      })
      return issuer ? { quote, issuer } : null
    })
    if (!snapshot)
      return { status: 404 as const, error: 'Orçamento não encontrado' }
    const { quote, issuer } = snapshot
    if (adjustments && !quote.adjustments.length)
      return {
        status: 404 as const,
        error: 'Nenhum reajuste encontrado para este orçamento',
      }
    const buffer = adjustments
      ? await renderQuoteAdjustmentPdf(quote, issuer)
      : await renderQuotePdf(
          {
            id: quote.id,
            quoteCode: quote.quoteCode,
            name: quote.name,
            email: quote.email,
            phone: quote.phone,
            createdAt: quote.createdAt,
            validUntil: quote.validUntil,
            startDate: quote.startDate,
            endDate: quote.endDate,
            originalTotal: quote.originalTotal?.toString() ?? null,
            total: quote.total?.toString() ?? '0',
            finalTotal: quote.finalTotal?.toString() ?? null,
            message: quote.message,
            items: quote.items.map((item) => ({
              name: item.equipment.name,
              quantity: item.quantity,
              days: item.days,
              pricePerDay: item.pricePerDay.toString(),
              total: item.total.toString(),
            })),
          },
          issuer
        )
    return {
      buffer,
      title: adjustments ? 'Reajuste' : 'Orcamento',
      identifier: quote.quoteCode ?? quote.id,
    }
  }
  return { generateQuoteDocument }
}
