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
import {
  calculateNetAmount,
  getTaxRateByDocumentType,
  resolveTaxDocumentType,
} from '@gb-locacoes/domain/financeiro'
import { getCurrentFinancialRates } from './financial-rates'
export function createFinancialEntries({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  return {
    readFinancialEntries(
      context: TenantContext,
      searchParams: URLSearchParams
    ) {
      return withTenantTransaction(context, async (prisma) => {
        const search = (searchParams.get('search') || '').trim()
        const status = parseFinancialStatusFilter(searchParams.get('status'))
        const startDate = parseFinancialDate(searchParams.get('startDate'))
        const endDate = parseFinancialDate(searchParams.get('endDate'))
        const page = Number.parseInt(searchParams.get('page') || '1', 10)
        const limit = Number.parseInt(searchParams.get('limit') || '50', 10)
        const skip = Math.max(0, (Math.max(page, 1) - 1) * Math.max(limit, 1))

        const where = buildFinancialPaymentsWhere({
          tenantId: context.tenantId,
          search,
          status,
          startDate,
          endDate,
          dateField: 'dueDate',
        })

        const buildStatusWhere = (
          billingStatus: 'PAID' | 'UNPAID' | 'AWAITING_PAYMENT'
        ): Prisma.PaymentWhereInput => ({
          AND: [where, { billingStatus }],
        })

        const [
          payments,
          total,
          rates,
          overallAgg,
          paidAgg,
          unpaidAgg,
          awaitingAgg,
        ] = await Promise.all([
          prisma.payment.findMany({
            where,
            include: {
              quote: {
                select: {
                  id: true,
                  quoteCode: true,
                  legacyExternalCode: true,
                  name: true,
                  email: true,
                  cpf: true,
                  cnpj: true,
                  company: true,
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
                      email: true,
                      cpf: true,
                      cnpj: true,
                      company: true,
                      user: { select: { id: true } },
                    },
                  },
                },
              },
            },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
            skip,
            take: limit,
          }),
          prisma.payment.count({ where }),
          getCurrentFinancialRates(context, prisma),
          prisma.payment.aggregate({
            where,
            _sum: { grossAmount: true, netAmount: true, amount: true },
          }),
          prisma.payment.aggregate({
            where: buildStatusWhere('PAID'),
            _sum: { grossAmount: true, netAmount: true, amount: true },
            _count: true,
          }),
          prisma.payment.aggregate({
            where: buildStatusWhere('UNPAID'),
            _sum: { grossAmount: true, netAmount: true, amount: true },
            _count: true,
          }),
          prisma.payment.aggregate({
            where: buildStatusWhere('AWAITING_PAYMENT'),
            _sum: { grossAmount: true, netAmount: true, amount: true },
            _count: true,
          }),
        ])

        const customers = await loadFinancialCustomers(context, prisma)
        const entries = payments.map((payment) => {
          const sourceQuote = payment.quote || payment.rental?.quote || null
          const sourceUser = customers.get(
            sourceQuote?.user?.id ?? payment.rental?.users?.id ?? ''
          )
          const customerName =
            sourceUser?.name || sourceQuote?.name || 'Cliente'
          const customerEmail = sourceUser?.email || sourceQuote?.email || null
          const customerDocument =
            sourceUser?.cnpj ||
            sourceQuote?.cnpj ||
            sourceUser?.cpf ||
            sourceQuote?.cpf ||
            ''

          const taxDocumentType =
            payment.taxDocumentType ||
            resolveTaxDocumentType({
              cnpj: sourceUser?.cnpj || sourceQuote?.cnpj,
              cpf: sourceUser?.cpf || sourceQuote?.cpf,
            })
          const taxRate =
            payment.taxRate != null
              ? Number(payment.taxRate)
              : getTaxRateByDocumentType(rates, taxDocumentType)
          const grossAmount = normalizeMoney(
            payment.grossAmount as Prisma.Decimal | null,
            Number(payment.amount)
          )
          const netAmount = normalizeMoney(
            payment.netAmount as Prisma.Decimal | null,
            calculateNetAmount(grossAmount, taxRate)
          )

          return {
            id: payment.id,
            paymentId: payment.id,
            rentalId: payment.rentalId || null,
            quoteId: sourceQuote?.id || null,
            quoteCode: sourceQuote?.quoteCode || null,
            legacyExternalCode: sourceQuote?.legacyExternalCode || null,
            customerName,
            customerEmail,
            customerDocument,
            customerCompany:
              sourceUser?.company || sourceQuote?.company || null,
            grossAmount,
            netAmount,
            taxRate,
            taxDocumentType,
            invoiceNumber: payment.invoiceNumber || null,
            boletoIssuedAt: payment.boletoIssuedAt,
            invoiceIssuedAt: payment.invoiceIssuedAt,
            dueDate: payment.dueDate,
            paidAt: payment.paidAt,
            settledAt: payment.settledAt,
            billingStatus: payment.billingStatus,
            gatewayStatus: payment.status,
            transactionId: payment.transactionId,
            metadata: payment.metadata,
            // Tax compliance fields (null for legacy entries)
            operationType: payment.operationType || null,
            rentalAmount: normalizeMoney(payment.rentalAmount, 0) || null,
            serviceAmount: normalizeMoney(payment.serviceAmount, 0) || null,
            taxRegimeSnapshot: payment.taxRegimeSnapshot || null,
            issAmount: normalizeMoney(payment.issAmount, 0) || null,
            irpjAmount: normalizeMoney(payment.irpjAmount, 0) || null,
            csllAmount: normalizeMoney(payment.csllAmount, 0) || null,
            pisCofinsAmount: normalizeMoney(payment.pisCofinsAmount, 0) || null,
            simplesAmount: normalizeMoney(payment.simplesAmount, 0) || null,
            taxBreakdown: payment.taxBreakdown || null,
          }
        })

        return {
          entries,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / Math.max(limit, 1)),
          },
          totals: {
            gross: Number(
              overallAgg._sum.grossAmount ?? overallAgg._sum.amount ?? 0
            ),
            net: Number(
              overallAgg._sum.netAmount ?? overallAgg._sum.amount ?? 0
            ),
            paid: Number(paidAgg._sum.grossAmount ?? paidAgg._sum.amount ?? 0),
            paidNet: Number(paidAgg._sum.netAmount ?? paidAgg._sum.amount ?? 0),
            paidCount: paidAgg._count,
            unpaid: Number(
              unpaidAgg._sum.grossAmount ?? unpaidAgg._sum.amount ?? 0
            ),
            unpaidCount: unpaidAgg._count,
            awaiting: Number(
              awaitingAgg._sum.grossAmount ?? awaitingAgg._sum.amount ?? 0
            ),
            awaitingCount: awaitingAgg._count,
            count: total,
          },
        }
      })
    },
  }
}
