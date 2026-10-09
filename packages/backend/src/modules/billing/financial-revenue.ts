import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'
import {
  buildFinancialPaymentsWhere,
  parseFinancialDate,
  parseFinancialStatusFilter,
} from './financial-scope'
import { normalizeFinancialMoney as normalizeMoney } from './financial-rates'
export function createFinancialRevenue({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  return {
    readFinancialRevenue(
      context: TenantContext,
      searchParams: URLSearchParams
    ) {
      return withTenantTransaction(context, async (prisma) => {
        const rawMonths = Number.parseInt(
          searchParams.get('months') || '12',
          10
        )
        const months =
          Number.isFinite(rawMonths) && rawMonths > 0 ? rawMonths : 12
        const search = (searchParams.get('search') || '').trim()
        const requestedStatus = parseFinancialStatusFilter(
          searchParams.get('status')
        )
        const startDate = parseFinancialDate(searchParams.get('startDate'))
        const endDate = parseFinancialDate(searchParams.get('endDate'))

        const now = new Date()
        const fallbackStartDate = new Date(now)
        fallbackStartDate.setMonth(fallbackStartDate.getMonth() - months)

        // Receita por padrão considera pagamentos efetivamente recebidos.
        const effectiveStatus =
          requestedStatus === 'all' ? 'PAID' : requestedStatus

        const where = buildFinancialPaymentsWhere({
          tenantId: context.tenantId,
          search,
          status: effectiveStatus,
          startDate: startDate || fallbackStartDate,
          endDate,
          dateField: 'paidAt',
        })

        const payments = await prisma.payment.findMany({
          where,
          select: {
            amount: true,
            grossAmount: true,
            paidAt: true,
            rental: {
              select: {
                rental_items: {
                  select: {
                    totalprice: true,
                    equipments: {
                      select: {
                        category: {
                          select: {
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })

        const monthlyRevenue = new Map<
          string,
          { key: string; month: string; revenue: number }
        >()
        const categoryRevenue = new Map<string, number>()
        const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
          month: 'short',
          year: 'numeric',
        })

        for (const payment of payments) {
          if (!payment.paidAt) continue

          const paidAt = new Date(payment.paidAt)
          const monthKey = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}`
          const monthLabel = monthFormatter.format(paidAt)
          const paymentAmount = normalizeMoney(
            payment.grossAmount as Prisma.Decimal | null,
            Number(payment.amount)
          )

          const monthBucket = monthlyRevenue.get(monthKey)
          if (monthBucket) {
            monthBucket.revenue += paymentAmount
          } else {
            monthlyRevenue.set(monthKey, {
              key: monthKey,
              month: monthLabel,
              revenue: paymentAmount,
            })
          }

          const items = payment.rental?.rental_items || []
          if (items.length === 0) {
            categoryRevenue.set(
              'Sem categoria',
              (categoryRevenue.get('Sem categoria') || 0) + paymentAmount
            )
            continue
          }

          const itemValues = items.map((item) =>
            normalizeMoney(item.totalprice as Prisma.Decimal | null, 0)
          )
          const totalItemsValue = itemValues.reduce(
            (sum, value) => sum + value,
            0
          )

          for (const [index, item] of items.entries()) {
            const itemValue = itemValues[index] ?? 0
            const categoryName =
              item.equipments?.category?.name || 'Sem categoria'
            const allocatedAmount =
              totalItemsValue > 0
                ? paymentAmount * (itemValue / totalItemsValue)
                : paymentAmount / items.length

            categoryRevenue.set(
              categoryName,
              (categoryRevenue.get(categoryName) || 0) + allocatedAmount
            )
          }
        }

        const revenueHistory = Array.from(monthlyRevenue.values())
          .sort((a, b) => a.key.localeCompare(b.key))
          .map(({ month, revenue }) => ({
            month,
            revenue: Number(revenue.toFixed(2)),
          }))

        const revenueByCategory = Array.from(categoryRevenue.entries())
          .map(([categoryName, revenue]) => ({
            categoryName,
            revenue: Number(revenue.toFixed(2)),
          }))
          .sort((a, b) => b.revenue - a.revenue)

        return {
          revenueHistory,
          revenueByCategory,
        }
      })
    },
  }
}
