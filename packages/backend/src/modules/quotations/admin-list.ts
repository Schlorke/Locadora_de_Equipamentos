import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'

/** Filtros da listagem administrativa já validados pelo adaptador HTTP. */
export type AdminQuoteFilters = {
  page: number
  limit: number
  search?: string
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  /** today, week, month; outros valores não filtram. */
  period?: string | null
  /** low, medium, high; outros valores não filtram. */
  valueRange?: string | null
}

const adminListInclude = {
  user: { select: { image: true } },
  rejectedByUser: { select: { id: true, name: true, image: true } },
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
  payments: {
    orderBy: {
      dueDate: 'asc',
    },
  },
} satisfies Prisma.QuoteInclude

type AdminListQuote = Prisma.QuoteGetPayload<{
  include: typeof adminListInclude
}>

/** Formato esperado pelo painel administrativo. */
function toAdminQuote(quote: AdminListQuote) {
  return {
    id: quote.id,
    quoteCode: quote.quoteCode,
    legacyExternalCode: quote.legacyExternalCode,
    paymentTerms: quote.paymentTerms,
    name: quote.name,
    email: quote.email,
    phone: quote.phone,
    company: quote.company,
    customerImage: quote.user?.image ?? null,
    cpf: quote.cpf || null,
    cnpj: quote.cnpj || null,
    cep: quote.cep || null,
    equipments: quote.items.map((item) => ({
      id: item.equipment.id,
      name: item.equipment.name,
      quantity: item.quantity,
      dailyPrice: Number(item.pricePerDay),
    })),
    startDate: quote.startDate?.toISOString() || null,
    endDate: quote.endDate?.toISOString() || null,
    totalPrice: Number(quote.total),
    originalTotal: quote.originalTotal
      ? Number(quote.originalTotal)
      : quote.total
        ? Number(quote.total)
        : 0,
    finalTotal: quote.finalTotal ? Number(quote.finalTotal) : null,
    priceAdjustmentReason: quote.priceAdjustmentReason || null,
    priceAdjustedAt: quote.priceAdjustedAt?.toISOString() || null,
    priceAdjustedBy: quote.priceAdjustedBy || null,
    lateFee: quote.lateFee ? Number(quote.lateFee) : null,
    lateFeeApproved: quote.lateFeeApproved || false,
    lateFeeApprovedAt: quote.lateFeeApprovedAt?.toISOString() || null,
    lateFeeApprovedBy: quote.lateFeeApprovedBy || null,
    validUntil: quote.validUntil?.toISOString() || null,
    rejectedAt: quote.rejectedAt?.toISOString() || null,
    rejectionReason: quote.rejectionReason || null,
    rejectedBy: quote.rejectedByUser
      ? {
          id: quote.rejectedByUser.id,
          name: quote.rejectedByUser.name,
          image: quote.rejectedByUser.image,
        }
      : null,
    approvedAt: quote.approvedAt?.toISOString() || null,
    payments: quote.payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      status: payment.status,
      method: payment.method,
      dueDate: payment.dueDate.toISOString(),
      paidAt: payment.paidAt?.toISOString() || null,
      metadata: payment.metadata || null,
    })),
    status: quote.status.toLowerCase() as
      'pending' | 'approved' | 'rejected' | 'completed',
    message: quote.message,
    deliveryType: quote.deliveryType || null,
    deliveryAddress: (() => {
      if (!quote.deliveryAddress) return null
      const addr =
        typeof quote.deliveryAddress === 'object' &&
        !Array.isArray(quote.deliveryAddress)
          ? (quote.deliveryAddress as Record<string, unknown>)
          : typeof quote.deliveryAddress === 'string'
            ? (JSON.parse(quote.deliveryAddress) as Record<string, unknown>)
            : null
      if (!addr) return null
      // Mapear campos em português para inglês (frontend espera inglês)
      return {
        street: addr.logradouro || addr.street || null,
        number: addr.numero || addr.number || null,
        complement: addr.complemento || addr.complement || null,
        neighborhood: addr.bairro || addr.neighborhood || null,
        city: addr.cidade || addr.city || null,
        state: addr.estado || addr.state || null,
        zipCode: addr.cep || addr.zipCode || null,
      }
    })(),
    deliveryFee: quote.deliveryFee != null ? Number(quote.deliveryFee) : null,
    pickupFee: quote.pickupFee != null ? Number(quote.pickupFee) : null,
    operationType: quote.operationType || null,
    serviceAmount:
      quote.serviceAmount != null ? Number(quote.serviceAmount) : null,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    items: quote.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      days: item.days,
      startDate:
        'startDate' in item && item.startDate
          ? (item.startDate as Date).toISOString()
          : null,
      endDate:
        'endDate' in item && item.endDate
          ? (item.endDate as Date).toISOString()
          : null,
      includeWeekends:
        'includeWeekends' in item ? (item.includeWeekends as boolean) : false,
      appliedDiscount:
        'appliedDiscount' in item && item.appliedDiscount
          ? Number(item.appliedDiscount)
          : null,
      appliedPeriod:
        'appliedPeriod' in item ? (item.appliedPeriod as string | null) : null,
      useDirectValue:
        'useDirectValue' in item ? (item.useDirectValue as boolean) : false,
      directValue:
        'directValue' in item && item.directValue
          ? Number(item.directValue)
          : null,
      pricePerDay: Number(item.pricePerDay),
      total: Number(item.total),
      equipment: {
        id: item.equipment.id,
        name: item.equipment.name,
        images:
          Array.isArray(item.equipment.images) &&
          item.equipment.images.length > 0
            ? item.equipment.images
            : null,
      },
    })),
  }
}

/** Listagem administrativa dos orçamentos da locadora com totais por status. */
export function createAdminQuoteListing({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  function listAdminQuotes(context: TenantContext, filters: AdminQuoteFilters) {
    return withTenantTransaction(context, async (prisma) => {
      const { page, limit, search, status, period, valueRange } = filters
      const skip = (page - 1) * limit

      const where: Prisma.QuoteWhereInput = { tenantId: context.tenantId }

      if (search) {
        where.OR = [
          { id: { contains: search, mode: 'insensitive' } },
          { quoteCode: { contains: search, mode: 'insensitive' } },
          { legacyExternalCode: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
        ]
      }

      if (status) where.status = status

      // Filtro por período (baseado em startDate ou createdAt)
      if (period && period !== 'all') {
        const now = new Date()
        let dateFrom: Date | undefined
        switch (period) {
          case 'today': {
            dateFrom = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate()
            )
            break
          }
          case 'week': {
            dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          }
          case 'month': {
            dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
          }
        }
        if (dateFrom) {
          // Filtrar quotes onde startDate OU createdAt >= dateFrom
          where.AND = [
            {
              OR: [
                { startDate: { gte: dateFrom } },
                {
                  AND: [{ startDate: null }, { createdAt: { gte: dateFrom } }],
                },
              ],
            },
          ]
        }
      }

      // Filtro por faixa de valor
      if (valueRange && valueRange !== 'all') {
        const totalFilter: Record<string, unknown> = {}
        switch (valueRange) {
          case 'low':
            totalFilter.lt = 500
            break
          case 'medium':
            totalFilter.gte = 500
            totalFilter.lt = 2000
            break
          case 'high':
            totalFilter.gte = 2000
            break
        }
        if (Object.keys(totalFilter).length > 0) {
          where.total = totalFilter
        }
      }

      const quotes = await prisma.quote.findMany({
        where,
        skip,
        take: limit,
        include: adminListInclude,
        orderBy: {
          createdAt: 'desc',
        },
      })

      const totalItems = await prisma.quote.count({ where })
      const totalPages = Math.ceil(totalItems / limit)

      const statuses = await prisma.quote.groupBy({
        by: ['status'],
        where: { tenantId: context.tenantId },
        _count: { _all: true },
      })
      const count = (value: string) =>
        statuses.find((row) => row.status === value)?._count._all ?? 0
      const total = statuses.reduce((sum, row) => sum + row._count._all, 0)

      return {
        quotes: quotes.map(toAdminQuote),
        pagination: { page, limit, totalItems, totalPages },
        stats: {
          total,
          pending: count('PENDING'),
          approved: count('APPROVED'),
          rejected: count('REJECTED'),
          expired: count('COMPLETED'),
        },
      }
    })
  }
  return { listAdminQuotes }
}

export type AdminQuoteListing = ReturnType<typeof createAdminQuoteListing>
