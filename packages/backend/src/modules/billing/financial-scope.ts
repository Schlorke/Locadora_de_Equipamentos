import { Prisma, type PaymentBillingStatus } from '@prisma/client'

type FinancialStatusFilter = 'all' | PaymentBillingStatus
type FinancialDateField = 'dueDate' | 'paidAt'

const VALID_FINANCIAL_STATUSES: PaymentBillingStatus[] = [
  'PAID',
  'UNPAID',
  'AWAITING_PAYMENT',
  'SETTLED',
]

const VALID_FINANCIAL_STATUS_SET = new Set(VALID_FINANCIAL_STATUSES)

export function parseFinancialStatusFilter(
  raw: string | null | undefined
): FinancialStatusFilter {
  const normalized = (raw || 'all').trim().toUpperCase()
  if (!normalized || normalized === 'ALL') return 'all'

  if (VALID_FINANCIAL_STATUS_SET.has(normalized as PaymentBillingStatus)) {
    return normalized as PaymentBillingStatus
  }

  return 'all'
}

export function parseFinancialDate(
  value: string | null | undefined
): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildFinancialSearchFilter(
  search: string,
  tenantId: string
): Prisma.PaymentWhereInput {
  const term = search.trim()
  if (!term) return {}

  return {
    OR: [
      {
        quote: {
          quoteCode: { contains: term, mode: 'insensitive' },
        },
      },
      {
        quote: {
          legacyExternalCode: { contains: term, mode: 'insensitive' },
        },
      },
      {
        quote: {
          name: { contains: term, mode: 'insensitive' },
        },
      },
      {
        quote: {
          user: {
            clientProfiles: {
              some: {
                tenantId,
                name: { contains: term, mode: 'insensitive' },
              },
            },
          },
        },
      },
      {
        quote: {
          company: { contains: term, mode: 'insensitive' },
        },
      },
      {
        rental: {
          quote: {
            quoteCode: { contains: term, mode: 'insensitive' },
          },
        },
      },
      {
        rental: {
          quote: {
            legacyExternalCode: { contains: term, mode: 'insensitive' },
          },
        },
      },
      {
        rental: {
          quote: {
            name: { contains: term, mode: 'insensitive' },
          },
        },
      },
      {
        rental: {
          quote: {
            user: {
              clientProfiles: {
                some: {
                  tenantId,
                  name: { contains: term, mode: 'insensitive' },
                },
              },
            },
          },
        },
      },
      {
        rental: {
          quote: {
            company: { contains: term, mode: 'insensitive' },
          },
        },
      },
      {
        rental: {
          users: {
            clientProfiles: {
              some: {
                tenantId,
                name: { contains: term, mode: 'insensitive' },
              },
            },
          },
        },
      },
      {
        rental: {
          users: {
            clientProfiles: {
              some: {
                tenantId,
                company: { contains: term, mode: 'insensitive' },
              },
            },
          },
        },
      },
    ],
  }
}

type BuildFinancialPaymentsWhereOptions = {
  tenantId: string
  search?: string | null
  status?: FinancialStatusFilter
  startDate?: Date | null
  endDate?: Date | null
  dateField?: FinancialDateField
  extraAnd?: Prisma.PaymentWhereInput[]
}

export function buildFinancialPaymentsWhere(
  options: BuildFinancialPaymentsWhereOptions
): Prisma.PaymentWhereInput {
  const {
    tenantId,
    search,
    status = 'all',
    startDate,
    endDate,
    dateField = 'dueDate',
    extraAnd = [],
  } = options

  if (!tenantId?.trim()) throw new Error('Tenant context required')

  const andFilters: Prisma.PaymentWhereInput[] = [
    {
      OR: [{ quoteId: { not: null } }, { rentalId: { not: null } }],
    },
  ]

  if (startDate || endDate) {
    const dateFilter: Prisma.DateTimeFilter = {}
    if (startDate) dateFilter.gte = startDate
    if (endDate) dateFilter.lte = endDate
    andFilters.push({
      [dateField]: dateFilter,
    } as Prisma.PaymentWhereInput)
  }

  if (status !== 'all' && VALID_FINANCIAL_STATUS_SET.has(status)) {
    andFilters.push({ billingStatus: status })
  }

  if (search?.trim()) {
    andFilters.push(buildFinancialSearchFilter(search, tenantId))
  }

  if (extraAnd.length > 0) {
    andFilters.push(...extraAnd)
  }

  return {
    tenantId,
    method: 'BOLETO',
    type: { in: ['RENTAL', 'DEPOSIT'] },
    AND: andFilters,
  }
}
