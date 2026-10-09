import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'
import {
  buildFinancialPaymentsWhere,
  parseFinancialDate,
  parseFinancialStatusFilter,
} from './financial-scope'
import { loadFinancialCustomers } from '../customers/index'
import { normalizeFinancialMoney as normalizeMoney } from './financial-rates'
type AgingStatus = 'current' | 'slight' | 'moderate' | 'severe' | 'critical'
function createEmptyAgingData() {
  return [
    { range: 'A vencer', amount: 0, count: 0, status: 'current' as const },
    { range: '1-30', amount: 0, count: 0, status: 'slight' as const },
    { range: '31-60', amount: 0, count: 0, status: 'moderate' as const },
    { range: '61-90', amount: 0, count: 0, status: 'severe' as const },
    { range: '+90', amount: 0, count: 0, status: 'critical' as const },
  ]
}
export function createFinancialAging({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  return {
    readFinancialAging(context: TenantContext, searchParams: URLSearchParams) {
      return withTenantTransaction(context, async (prisma) => {
        const search = (searchParams.get('search') || '').trim()
        const requestedStatus = parseFinancialStatusFilter(
          searchParams.get('status')
        )
        const startDate = parseFinancialDate(searchParams.get('startDate'))
        const endDate = parseFinancialDate(searchParams.get('endDate'))

        const pendingStatuses: Array<'AWAITING_PAYMENT' | 'UNPAID'> = [
          'AWAITING_PAYMENT',
          'UNPAID',
        ]

        const statusScope =
          requestedStatus === 'all'
            ? pendingStatuses
            : pendingStatuses.includes(
                  requestedStatus as 'AWAITING_PAYMENT' | 'UNPAID'
                )
              ? [requestedStatus as 'AWAITING_PAYMENT' | 'UNPAID']
              : []

        if (statusScope.length === 0) {
          return {
            agingData: createEmptyAgingData(),
            topDebtors: [],
            delinquencyRate: 0,
            severeCount: 0,
          }
        }

        const baseWhere = buildFinancialPaymentsWhere({
          tenantId: context.tenantId,
          search,
          startDate,
          endDate,
          dateField: 'dueDate',
        })

        const where: Prisma.PaymentWhereInput = {
          AND: [baseWhere, { billingStatus: { in: statusScope } }],
        }

        const now = new Date()
        const payments = await prisma.payment.findMany({
          where,
          include: {
            rental: {
              include: {
                users: { select: { id: true } },
                quote: {
                  select: {
                    id: true,
                    quoteCode: true,
                    name: true,
                    user: { select: { id: true } },
                  },
                },
              },
            },
            quote: {
              include: {
                user: { select: { id: true } },
              },
            },
          },
        })

        const customers = await loadFinancialCustomers(context, prisma)
        const agingBuckets: Record<
          string,
          {
            amount: number
            count: number
            status: AgingStatus
          }
        > = {
          'A vencer': { amount: 0, count: 0, status: 'current' },
          '1-30': { amount: 0, count: 0, status: 'slight' },
          '31-60': { amount: 0, count: 0, status: 'moderate' },
          '61-90': { amount: 0, count: 0, status: 'severe' },
          '+90': { amount: 0, count: 0, status: 'critical' },
        }

        const debtorsMap: Record<
          string,
          {
            clientName: string
            overdueAmount: number
            maxDaysOverdue: number
            status: 'overdue' | 'attention' | 'critical'
          }
        > = {}

        let totalReceivable = 0
        let totalOverdue = 0

        for (const payment of payments) {
          if (!payment.dueDate) continue

          const dueDate = new Date(payment.dueDate)
          const daysOverdue = Math.ceil(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          )
          const amount = normalizeMoney(
            payment.grossAmount as Prisma.Decimal | null,
            Number(payment.amount)
          )

          totalReceivable += amount

          let bucket: string
          let status: AgingStatus

          if (daysOverdue <= 0) {
            bucket = 'A vencer'
            status = 'current'
          } else if (daysOverdue <= 30) {
            bucket = '1-30'
            status = 'slight'
            totalOverdue += amount
          } else if (daysOverdue <= 60) {
            bucket = '31-60'
            status = 'moderate'
            totalOverdue += amount
          } else if (daysOverdue <= 90) {
            bucket = '61-90'
            status = 'severe'
            totalOverdue += amount
          } else {
            bucket = '+90'
            status = 'critical'
            totalOverdue += amount
          }

          const bucketData = agingBuckets[bucket]
          if (bucketData) {
            bucketData.amount += amount
            bucketData.count += 1
            bucketData.status = status
          }

          // Only add to debtors if actually overdue
          if (daysOverdue > 0) {
            const sourceQuote = payment.quote || payment.rental?.quote || null
            const sourceUser = customers.get(
              sourceQuote?.user?.id ?? payment.rental?.users?.id ?? ''
            )
            const clientName =
              sourceUser?.name || sourceQuote?.name || 'Cliente'

            if (!debtorsMap[clientName]) {
              debtorsMap[clientName] = {
                clientName,
                overdueAmount: 0,
                maxDaysOverdue: 0,
                status: 'overdue',
              }
            }

            debtorsMap[clientName].overdueAmount += amount
            debtorsMap[clientName].maxDaysOverdue = Math.max(
              debtorsMap[clientName].maxDaysOverdue,
              daysOverdue
            )

            if (daysOverdue > 90) {
              debtorsMap[clientName].status = 'critical'
            } else if (daysOverdue > 60) {
              debtorsMap[clientName].status = 'attention'
            } else {
              debtorsMap[clientName].status = 'overdue'
            }
          }
        }

        const agingData = Object.entries(agingBuckets).map(([range, data]) => ({
          range,
          amount: Number(data.amount.toFixed(2)),
          count: data.count,
          status: data.status,
        }))

        const topDebtors = Object.values(debtorsMap)
          .map((debtor) => ({
            clientName: debtor.clientName,
            overdueAmount: Number(debtor.overdueAmount.toFixed(2)),
            daysOverdue: debtor.maxDaysOverdue,
            status: debtor.status,
          }))
          .sort((a, b) => b.overdueAmount - a.overdueAmount)
          .slice(0, 10)

        const delinquencyRate =
          totalReceivable > 0
            ? Number(((totalOverdue / totalReceivable) * 100).toFixed(1))
            : 0

        // Count of entries with >60 days overdue (for sidebar badge)
        const severeCount = Object.values(agingBuckets)
          .filter((b) => b.status === 'severe' || b.status === 'critical')
          .reduce((sum, b) => sum + b.count, 0)

        return {
          agingData,
          topDebtors,
          delinquencyRate,
          severeCount,
        }
      })
    },
  }
}
