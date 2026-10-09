import type { Prisma } from '@prisma/client'
import type { TenantPrincipal } from '../identity/index'
import { admitRentalCommand } from '../entitlements/command-admission'
import type { TenantTransactionRunner } from '../rentals/index'

const clientQuoteInclude = {
  items: {
    include: {
      equipment: {
        select: {
          id: true,
          name: true,
          images: true,
          pricePerDay: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
  payments: {
    orderBy: {
      dueDate: 'asc',
    },
  },
  adjustments: {
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.QuoteInclude

/** Portal do cliente: só os orçamentos do próprio usuário na locadora ativa. */
export function createClientQuotePortal({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  /** Lista no contrato legado do histórico do cliente; ownership e remoção scoped. */
  async function listClientQuotes(principal: TenantPrincipal) {
    const quotes = await withTenantTransaction(principal, (tx) =>
      tx.quote.findMany({
        where: {
          tenantId: principal.tenantId,
          userId: principal.userId,
          clientDeletedAt: null,
        },
        include: {
          items: {
            include: {
              equipment: {
                select: {
                  id: true,
                  name: true,
                  pricePerDay: true,
                  images: true,
                },
              },
            },
          },
          payments: { orderBy: { dueDate: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      })
    )
    const transformedQuotes = quotes.map((quote) => ({
      id: quote.id,
      quoteCode: quote.quoteCode,
      legacyExternalCode: quote.legacyExternalCode,
      paymentTerms: quote.paymentTerms,
      name: quote.name,
      email: quote.email,
      phone: quote.phone,
      company: quote.company || null,
      deliveryAddress: quote.deliveryAddress || null,
      deliveryType: quote.deliveryType || null,
      totalPrice: Number(quote.total),
      originalTotal: quote.originalTotal
        ? Number(quote.originalTotal)
        : quote.total
          ? Number(quote.total)
          : 0,
      finalTotal: quote.finalTotal ? Number(quote.finalTotal) : null,
      priceAdjustmentReason: quote.priceAdjustmentReason || null,
      priceAdjustedAt: quote.priceAdjustedAt?.toISOString() || null,
      lateFee: quote.lateFee ? Number(quote.lateFee) : null,
      lateFeeApproved: quote.lateFeeApproved || false,
      status: quote.status.toLowerCase() as
        'pending' | 'approved' | 'rejected' | 'completed',
      payments: quote.payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        status: payment.status,
        method: payment.method,
        dueDate: payment.dueDate.toISOString(),
        paidAt: payment.paidAt?.toISOString() || null,
        metadata: payment.metadata || null,
      })),
      createdAt: quote.createdAt.toISOString(),
      updatedAt: quote.updatedAt.toISOString(),
      validUntil: quote.validUntil?.toISOString() || null,
      items: quote.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        days: item.days,
        startDate: item.startDate?.toISOString() || null,
        endDate: item.endDate?.toISOString() || null,
        pricePerDay: Number(item.pricePerDay),
        total: Number(item.total),
        equipment: {
          id: item.equipment.id,
          name: item.equipment.name,
        },
      })),
    }))

    return transformedQuotes
  }

  /** Orçamento no formato do portal, ou `null` quando não é do cliente ou foi removido. */
  function readClientQuote(principal: TenantPrincipal, id: string) {
    return withTenantTransaction(principal, async (tx) => {
      // Buscar o orçamento do cliente
      const quote = await tx.quote.findFirst({
        where: {
          tenantId: principal.tenantId,
          id: id,
          userId: principal.userId,
          clientDeletedAt: null,
        },
        include: clientQuoteInclude,
      })

      if (!quote) return null

      // Orçamento rejeitado: não expor metadata (pdfUrl do boleto) ao cliente.
      // Usar sempre o enum do Prisma (uppercase); o status na resposta é transformado em lowercase depois.
      const isRejected = quote.status === 'REJECTED'

      // Transformar dados para formato esperado pelo frontend
      return {
        id: quote.id,
        quoteCode: quote.quoteCode || null,
        legacyExternalCode: quote.legacyExternalCode || null,
        name: quote.name,
        email: quote.email,
        phone: quote.phone,
        company: quote.company || null,
        totalPrice: Number(quote.total),
        originalTotal: quote.originalTotal
          ? Number(quote.originalTotal)
          : Number(quote.total),
        finalTotal: quote.finalTotal ? Number(quote.finalTotal) : null,
        priceAdjustmentReason: quote.priceAdjustmentReason || null,
        priceAdjustedAt: quote.priceAdjustedAt?.toISOString() || null,
        lateFee: quote.lateFee ? Number(quote.lateFee) : null,
        lateFeeApproved: quote.lateFeeApproved || false,
        status: quote.status.toLowerCase() as
          'pending' | 'approved' | 'rejected' | 'completed',
        deliveryType: quote.deliveryType || null,
        deliveryFee:
          quote.deliveryFee != null ? Number(quote.deliveryFee) : null,
        pickupFee: quote.pickupFee != null ? Number(quote.pickupFee) : null,
        deliveryAddress: quote.deliveryAddress || null,
        createdAt: quote.createdAt.toISOString(),
        updatedAt: quote.updatedAt.toISOString(),
        approvedAt: quote.approvedAt?.toISOString() || null,
        rejectedAt: quote.rejectedAt?.toISOString() || null,
        validUntil: quote.validUntil?.toISOString() || null,
        items: quote.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          days: item.days,
          startDate: item.startDate?.toISOString() || null,
          endDate: item.endDate?.toISOString() || null,
          pricePerDay: Number(item.pricePerDay),
          total: Number(item.total),
          appliedDiscount: item.appliedDiscount
            ? Number(item.appliedDiscount)
            : null,
          appliedPeriod: item.appliedPeriod || null,
          useDirectValue: item.useDirectValue || false,
          directValue: item.directValue ? Number(item.directValue) : null,
          includeWeekends: item.includeWeekends ?? false,
          equipment: {
            id: item.equipment.id,
            name: item.equipment.name,
            images: item.equipment.images || [],
            category: item.equipment.category || null,
          },
        })),
        payments: quote.payments.map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          status: payment.status,
          method: payment.method,
          dueDate: payment.dueDate.toISOString(),
          paidAt: payment.paidAt?.toISOString() || null,
          metadata: isRejected ? null : payment.metadata || null,
        })),
        adjustments:
          quote.adjustments?.map((adj) => ({
            id: adj.id,
            category: adj.category,
            amount: Number(adj.amount),
            justification: adj.justification,
          })) ?? [],
      }
    })
  }

  /** Soft delete pelo cliente (não altera o status no admin); `false` quando não é dele. */
  function hideClientQuote(principal: TenantPrincipal, id: string) {
    return withTenantTransaction(principal, async (tx) => {
      // Verificar se o orçamento pertence ao cliente logado
      const quote = await tx.quote.findFirst({
        where: {
          tenantId: principal.tenantId,
          id: id,
          userId: principal.userId,
        },
      })

      if (!quote) return false
      await admitRentalCommand(tx, principal, {})

      await tx.quote.update({
        where: {
          tenantId: principal.tenantId,
          userId: principal.userId,
          id: id,
        },
        data: { clientDeletedAt: new Date() },
      })
      return true
    })
  }

  return { listClientQuotes, readClientQuote, hideClientQuote }
}

export type ClientQuotePortal = ReturnType<typeof createClientQuotePortal>
