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
import type { ExportRow } from './financial-report-types'
function fmtDate(d: Date | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('pt-BR')
}
const STATUS_LABELS: Record<string, string> = {
  PAID: 'Pago',
  UNPAID: 'Não Pago',
  AWAITING_PAYMENT: 'Aguardando',
  SETTLED: 'Liquidado',
}

/* ---------- shared data loading ---------- */

const OPERATION_TYPE_LABELS: Record<string, string> = {
  PURE_RENTAL: 'Locação Pura',
  RENTAL_WITH_SERVICE: 'Locação + Serviço',
}

const REGIME_LABELS: Record<string, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
}

export function createFinancialExport({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  async function loadExportData(
    context: TenantContext,
    searchParams: URLSearchParams
  ) {
    return withTenantTransaction(context, async (prisma) => {
      const search = (searchParams.get('search') || '').trim()
      const status = parseFinancialStatusFilter(searchParams.get('status'))
      const startDate = parseFinancialDate(searchParams.get('startDate'))
      const endDate = parseFinancialDate(searchParams.get('endDate'))
      const idsParam = (searchParams.get('ids') || '').trim()

      const where = buildFinancialPaymentsWhere({
        tenantId: context.tenantId,
        search,
        status,
        startDate,
        endDate,
        dateField: 'dueDate',
      })

      // When specific IDs are provided, restrict to those entries only
      if (idsParam) {
        const ids = idsParam.split(',').filter(Boolean)
        if (ids.length > 0) {
          const andArray = Array.isArray(where.AND)
            ? where.AND
            : where.AND
              ? [where.AND]
              : []
          andArray.push({ id: { in: ids } })
          where.AND = andArray
        }
      }

      const [payments, rates] = await Promise.all([
        prisma.payment.findMany({
          where,
          include: {
            quote: {
              select: {
                id: true,
                quoteCode: true,
                legacyExternalCode: true,
                name: true,
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
        }),
        getCurrentFinancialRates(context, prisma),
      ])

      const customers = await loadFinancialCustomers(context, prisma)
      const rows: ExportRow[] = payments.map((payment) => {
        const sourceQuote = payment.quote || payment.rental?.quote || null
        const sourceUser = customers.get(
          sourceQuote?.user?.id ?? payment.rental?.users?.id ?? ''
        )
        const customerName = sourceUser?.name || sourceQuote?.name || 'Cliente'
        const customerCompany =
          sourceUser?.company || sourceQuote?.company || ''
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
          quoteCode: sourceQuote?.quoteCode || '-',
          legacyCode: sourceQuote?.legacyExternalCode || '-',
          customerName,
          customerCompany,
          customerDocument,
          grossAmount,
          netAmount,
          taxRate,
          invoiceNumber: payment.invoiceNumber || '-',
          boletoIssuedAt: fmtDate(payment.boletoIssuedAt),
          invoiceIssuedAt: fmtDate(payment.invoiceIssuedAt),
          dueDate: fmtDate(payment.dueDate),
          dueDateRaw: payment.dueDate ? new Date(payment.dueDate) : null,
          paidAt: fmtDate(payment.paidAt),
          billingStatus: payment.billingStatus || 'AWAITING_PAYMENT',
          billingStatusLabel:
            STATUS_LABELS[payment.billingStatus || ''] ||
            payment.billingStatus ||
            '-',
          operationType:
            OPERATION_TYPE_LABELS[payment.operationType || ''] ||
            'Locação Pura',
          taxRegime: REGIME_LABELS[payment.taxRegimeSnapshot || ''] || '-',
          taxDocumentType,
          issAmount: normalizeMoney(
            payment.issAmount as Prisma.Decimal | null,
            0
          ),
        }
      })

      const totalGross = rows.reduce((s, r) => s + r.grossAmount, 0)
      const totalNet = rows.reduce((s, r) => s + r.netAmount, 0)
      const totalPaid = rows
        .filter((r) => r.billingStatus === 'PAID')
        .reduce((s, r) => s + r.grossAmount, 0)
      const totalPending = rows
        .filter((r) => ['UNPAID', 'AWAITING_PAYMENT'].includes(r.billingStatus))
        .reduce((s, r) => s + r.grossAmount, 0)

      let periodLabel = 'Todos os Períodos'
      if (startDate && endDate) {
        periodLabel = `${fmtDate(startDate)} a ${fmtDate(endDate)}`
      } else if (startDate) {
        periodLabel = `A partir de ${fmtDate(startDate)}`
      } else if (endDate) {
        periodLabel = `Até ${fmtDate(endDate)}`
      }

      return {
        rows,
        totalGross,
        totalNet,
        totalPaid,
        totalPending,
        periodLabel,
      }
    })
  }
  return {
    async readFinancialExport(
      context: TenantContext,
      searchParams: URLSearchParams
    ) {
      const data = await loadExportData(context, searchParams)
      const organization = await withTenantTransaction(context, (tx) =>
        tx.organization.findUniqueOrThrow({
          where: { id: context.tenantId },
          select: { name: true },
        })
      )
      return { ...data, companyName: organization.name }
    },
  }
}
