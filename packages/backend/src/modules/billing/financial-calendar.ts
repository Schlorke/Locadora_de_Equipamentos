import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'
import {
  buildFinancialPaymentsWhere,
  parseFinancialDate,
  parseFinancialStatusFilter,
} from './financial-scope'
import { loadFinancialCustomers } from '../customers/index'
import { financialCalendarColors } from '@gb-locacoes/design-tokens/documents'
export function createFinancialCalendar({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  return {
    readFinancialCalendar(
      context: TenantContext,
      searchParams: URLSearchParams
    ) {
      return withTenantTransaction(context, async (prisma) => {
        const status = parseFinancialStatusFilter(searchParams.get('status'))
        const start = parseFinancialDate(searchParams.get('start'))
        const end = parseFinancialDate(searchParams.get('end'))
        const where = buildFinancialPaymentsWhere({
          tenantId: context.tenantId,
          status,
          startDate: start,
          endDate: end,
          dateField: 'dueDate',
        })

        const payments = await prisma.payment.findMany({
          where,
          include: {
            quote: {
              select: {
                id: true,
                quoteCode: true,
                legacyExternalCode: true,
                name: true,
                user: { select: { id: true } },
              },
            },
            rental: {
              select: {
                id: true,
                users: { select: { id: true } },
                quote: {
                  select: {
                    id: true,
                    quoteCode: true,
                    legacyExternalCode: true,
                    name: true,
                    user: { select: { id: true } },
                  },
                },
              },
            },
          },
          orderBy: { dueDate: 'asc' },
        })

        const customers = await loadFinancialCustomers(context, prisma)
        const events = payments.map((payment) => {
          const sourceQuote = payment.quote || payment.rental?.quote || null
          const sourceUser = customers.get(
            sourceQuote?.user?.id ?? payment.rental?.users?.id ?? ''
          )
          const quoteCode =
            sourceQuote?.quoteCode || sourceQuote?.id || 'SEM-COD'
          const customerName =
            sourceUser?.name || sourceQuote?.name || 'Cliente'
          const title = `${quoteCode} - ${customerName}`

          return {
            id: payment.id,
            title,
            start: payment.paidAt || payment.dueDate,
            end: payment.paidAt || payment.dueDate,
            status: payment.billingStatus,
            amount: Number(payment.grossAmount || payment.amount),
            rentalId: payment.rentalId || null,
            quoteId: sourceQuote?.id || null,
            quoteCode: sourceQuote?.quoteCode || null,
            legacyExternalCode: sourceQuote?.legacyExternalCode || null,
            customerName,
            color:
              payment.billingStatus === 'PAID'
                ? financialCalendarColors.paid
                : payment.billingStatus === 'UNPAID'
                  ? financialCalendarColors.unpaid
                  : payment.billingStatus === 'SETTLED'
                    ? financialCalendarColors.settled
                    : financialCalendarColors.awaiting,
          }
        })

        return { events }
      })
    },
  }
}
