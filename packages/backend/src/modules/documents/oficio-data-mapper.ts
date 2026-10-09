import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'
import type { EmailBranding } from '../communications/index'
import { RentalMutationError } from '../rentals/index'
/**
 * Maps Prisma query results to OficioData for PDF generation.
 */
import type { Prisma } from '@prisma/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Decimal from 'decimal.js'

import { getCurrentTaxSettings } from '../quotations/index'
import {
  calculateTaxBreakdown,
  getRetentionRate,
  type TaxSettings,
} from '@gb-locacoes/domain/financeiro'
import {
  ADJUSTMENT_CATEGORY_LABELS,
  PAYMENT_TERMS_LABELS,
  QUOTE_STATUS_LABELS,
} from './oficio-styles'
import type {
  OficioClientInfo,
  OficioCompanyInfo,
  OficioData,
  OficioFinancialSummary,
  OficioRentalItem,
  OficioServiceItem,
} from './oficio-types'

export function createOficioMapper({
  withTenantTransaction,
  loadTenantBranding,
}: {
  withTenantTransaction: TenantTransactionRunner
  loadTenantBranding: (
    context: TenantContext,
    db?: Prisma.TransactionClient
  ) => Promise<EmailBranding>
}) {
  /* ---------- helpers ---------- */

  function dec(v: unknown): Decimal {
    if (v instanceof Decimal) return v
    if (v === null || v === undefined) return new Decimal(0)
    return new Decimal(String(v))
  }

  function fmtDate(d: Date | string | null | undefined, short = false): string {
    if (!d) return '-'
    const date = typeof d === 'string' ? new Date(d) : d
    return format(date, short ? 'dd/MM/yy' : 'dd/MM/yyyy', { locale: ptBR })
  }

  function fmtMonthName(d: Date | string | null | undefined): string {
    if (!d) return '-'
    const date = typeof d === 'string' ? new Date(d) : d
    return format(date, 'MMMM', { locale: ptBR })
  }

  function formatDocument(doc: string | null | undefined): string {
    if (!doc) return '-'
    const clean = doc.replace(/\D/g, '')
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    if (clean.length === 14) {
      return clean.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
        '$1.$2.$3/$4-$5'
      )
    }
    return doc
  }

  function buildAddressString(
    addr:
      | {
          street?: string
          number?: string
          complement?: string | null
          neighborhood?: string
          city?: string
          state?: string
          zipCode?: string
        }
      | null
      | undefined
  ): string {
    if (!addr) return '-'
    const parts = [
      addr.street,
      addr.number,
      addr.complement,
      addr.neighborhood,
      addr.city && addr.state ? `${addr.city}/${addr.state}` : addr.city,
      addr.zipCode ? `CEP ${addr.zipCode}` : null,
    ].filter(Boolean)
    return parts.join(', ') || '-'
  }

  /* ---------- Company info scoped to the selected organization ---------- */

  async function getCompanyInfo(
    context: TenantContext,
    db: Prisma.TransactionClient
  ): Promise<OficioCompanyInfo> {
    const organization = await db.organization.findUnique({
      where: { id: context.tenantId },
    })
    if (
      !organization ||
      organization.status !== 'ACTIVE' ||
      !organization.document ||
      !organization.city ||
      !organization.state
    )
      throw new RentalMutationError(
        'Configure documento, cidade e estado da locadora antes de gerar o ofício',
        409,
        'COMPANY_PROFILE_REQUIRED'
      )
    const brand = await loadTenantBranding(context, db)
    return {
      razaoSocial: organization.name,
      cnpj: formatDocument(organization.document),
      endereco: brand.address || '',
      cidade: organization.city,
      estado: organization.state,
      telefone: brand.phone || '',
      email: brand.contactEmail || '',
      website: brand.publicBaseUrl,
    }
  }
  async function loadOficioContext(
    context: TenantContext,
    userId: string | null | undefined
  ) {
    return withTenantTransaction(context, async (tx) => {
      const settings = await getCurrentTaxSettings(tx, context.tenantId)
      const company = await getCompanyInfo(context, tx)
      const customer = userId
        ? await tx.clientProfile.findFirst({
            where: { tenantId: context.tenantId, userId },
          })
        : null
      const billingAddress = userId
        ? await tx.address.findFirst({
            where: { tenantId: context.tenantId, userId },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          })
        : null
      return { settings, company, customer, billingAddress }
    })
  }

  /* ---------- Prisma result types ---------- */

  type PaymentWithRelations = Prisma.PaymentGetPayload<{
    include: {
      quote: {
        include: {
          items: {
            include: { equipment: { include: { category: true } } }
          }
          adjustments: { include: { createdByUser: true } }
          user: { include: { addresses: true } }
        }
      }
    }
  }>

  type QuoteWithRelations = Prisma.QuoteGetPayload<{
    include: {
      items: {
        include: { equipment: { include: { category: true } } }
      }
      adjustments: { include: { createdByUser: true } }
      payments: true
      user: { include: { addresses: true } }
    }
  }>

  /* ---------- Data mapper from Payment ---------- */

  async function mapPaymentToOficioData(
    context: TenantContext,
    payment: PaymentWithRelations,
    preview = false
  ): Promise<OficioData> {
    const quote = payment.quote
    if (!quote || quote.tenantId !== context.tenantId)
      throw new RentalMutationError('Orçamento não encontrado', 404)
    const {
      settings,
      company,
      customer,
      billingAddress: primaryAddr,
    } = await loadOficioContext(context, quote.userId)
    const now = new Date()

    // Resolve document from payment or quote
    const rawDoc = quote?.cnpj || quote?.cpf || customer?.document || ''
    const docType = payment.taxDocumentType || (quote?.cnpj ? 'CNPJ' : 'CPF')

    // Reference date: boleto date, due date, or creation date
    const refDate =
      payment.boletoIssuedAt || payment.dueDate || payment.createdAt

    // Build client info
    const clientName = quote?.company || quote?.name || '-'
    const clientEmail = quote?.email || customer?.email || ''
    const clientPhone = quote?.phone || customer?.phone || ''

    // Addresses
    const deliveryAddr = quote?.deliveryAddress as Record<string, string> | null

    const cliente: OficioClientInfo = {
      codigo:
        quote?.quoteCode || quote?.legacyExternalCode || payment.id.slice(0, 8),
      razaoSocial: clientName,
      documento: formatDocument(rawDoc),
      tipoDocumento: docType as 'CPF' | 'CNPJ' | 'CNI',
      obra: (quote?.adminNotes || quote?.message || '').slice(0, 100),
      mesReferencia: fmtMonthName(refDate),
      anoReferencia: refDate ? format(refDate, 'yyyy') : format(now, 'yyyy'),
      contato: [clientPhone, clientEmail].filter(Boolean).join(' / ') || '-',
      forma: PAYMENT_TERMS_LABELS[quote?.paymentTerms || 'UPFRONT'] || '-',
      aprovacao: fmtDate(quote?.approvedAt),
      fatura: payment.invoiceNumber || '-',
      boleto: payment.transactionId || '-',
      endereco: deliveryAddr
        ? buildAddressString(deliveryAddr)
        : buildAddressString(primaryAddr),
      enderecoCobranca: buildAddressString(primaryAddr),
      nota: payment.nfseNumber || payment.invoiceNumber || '-',
      cei: '-',
      im: '-',
      ie: '-',
    }

    // Rental items
    const itensLocacao: OficioRentalItem[] = (quote?.items || []).map(
      (item, idx) => ({
        index: idx + 1,
        equipamento: item.equipment?.name || 'Equipamento',
        inicio: fmtDate(item.startDate, true),
        fim: fmtDate(item.endDate, true),
        quantidade: item.quantity,
        dias: item.days,
        valor: dec(item.total).toNumber(),
        situacao: QUOTE_STATUS_LABELS[quote?.status || 'PENDING'] || 'Pendente',
      })
    )

    // Service items (adjustments)
    const itensServico: OficioServiceItem[] = (quote?.adjustments || []).map(
      (adj, idx) => ({
        index: idx + 1,
        servico: ADJUSTMENT_CATEGORY_LABELS[adj.category] || adj.category,
        data: fmtDate(adj.createdAt, true),
        descricao: adj.justification || '',
        quantidade: 1,
        valorUnitario: dec(adj.amount).toNumber(),
        valorTotal: dec(adj.amount).toNumber(),
      })
    )

    // Financial summary
    const resumo = calculateOficioSummary(
      payment,
      itensLocacao,
      itensServico,
      settings,
      docType as 'CPF' | 'CNPJ' | 'CNI'
    )

    return {
      empresa: company,
      cliente,
      itensLocacao,
      itensServico,
      resumo,
      observacoes:
        (payment.metadata as Record<string, string>)?.notes ||
        quote?.internalNotes ||
        '',
      preview,
      geradoEm: format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    }
  }

  /* ---------- Data mapper from Quote ---------- */

  async function mapQuoteToOficioData(
    context: TenantContext,
    quote: QuoteWithRelations,
    preview = false
  ): Promise<OficioData> {
    if (!quote || quote.tenantId !== context.tenantId)
      throw new RentalMutationError('Orçamento não encontrado', 404)
    const {
      settings,
      company,
      customer,
      billingAddress: primaryAddr,
    } = await loadOficioContext(context, quote.userId)
    const now = new Date()

    const rawDoc = quote.cnpj || quote.cpf || customer?.document || ''
    const docType = quote.cnpj ? 'CNPJ' : 'CPF'

    const payment = quote.payments?.[0]
    const refDate =
      payment?.boletoIssuedAt || payment?.dueDate || quote.createdAt

    const clientName = quote.company || quote.name || '-'
    const clientEmail = quote.email || customer?.email || ''
    const clientPhone = quote.phone || customer?.phone || ''

    const deliveryAddr = quote.deliveryAddress as Record<string, string> | null

    const cliente: OficioClientInfo = {
      codigo:
        quote.quoteCode || quote.legacyExternalCode || quote.id.slice(0, 8),
      razaoSocial: clientName,
      documento: formatDocument(rawDoc),
      tipoDocumento: docType as 'CPF' | 'CNPJ' | 'CNI',
      obra: (quote.adminNotes || quote.message || '').slice(0, 100),
      mesReferencia: fmtMonthName(refDate),
      anoReferencia: refDate ? format(refDate, 'yyyy') : format(now, 'yyyy'),
      contato: [clientPhone, clientEmail].filter(Boolean).join(' / ') || '-',
      forma: PAYMENT_TERMS_LABELS[quote.paymentTerms || 'UPFRONT'] || '-',
      aprovacao: fmtDate(quote.approvedAt),
      fatura: payment?.invoiceNumber || '-',
      boleto: payment?.transactionId || '-',
      endereco: deliveryAddr
        ? buildAddressString(deliveryAddr)
        : buildAddressString(primaryAddr),
      enderecoCobranca: buildAddressString(primaryAddr),
      nota: payment?.nfseNumber || payment?.invoiceNumber || '-',
      cei: '-',
      im: '-',
      ie: '-',
    }

    const itensLocacao: OficioRentalItem[] = (quote.items || []).map(
      (item, idx) => ({
        index: idx + 1,
        equipamento: item.equipment?.name || 'Equipamento',
        inicio: fmtDate(item.startDate, true),
        fim: fmtDate(item.endDate, true),
        quantidade: item.quantity,
        dias: item.days,
        valor: dec(item.total).toNumber(),
        situacao: QUOTE_STATUS_LABELS[quote.status || 'PENDING'] || 'Pendente',
      })
    )

    const itensServico: OficioServiceItem[] = (quote.adjustments || []).map(
      (adj, idx) => ({
        index: idx + 1,
        servico: ADJUSTMENT_CATEGORY_LABELS[adj.category] || adj.category,
        data: fmtDate(adj.createdAt, true),
        descricao: adj.justification || '',
        quantidade: 1,
        valorUnitario: dec(adj.amount).toNumber(),
        valorTotal: dec(adj.amount).toNumber(),
      })
    )

    // Use payment gross if available, else compute from quote
    const grossAmount = payment
      ? dec(payment.grossAmount || payment.amount).toNumber()
      : dec(quote.finalTotal || quote.total).toNumber()

    const resumo = calculateOficioSummaryFromValues(
      grossAmount,
      itensLocacao,
      itensServico,
      settings,
      docType as 'CPF' | 'CNPJ' | 'CNI',
      (quote.operationType as 'PURE_RENTAL' | 'RENTAL_WITH_SERVICE') ||
        'PURE_RENTAL'
    )

    return {
      empresa: company,
      cliente,
      itensLocacao,
      itensServico,
      resumo,
      observacoes: quote.internalNotes || '',
      preview: preview || quote.status === 'PENDING',
      geradoEm: format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    }
  }

  /* ---------- Financial Summary ---------- */

  function calculateOficioSummary(
    payment: PaymentWithRelations,
    rentalItems: OficioRentalItem[],
    serviceItems: OficioServiceItem[],
    settings: TaxSettings,
    docType: 'CPF' | 'CNPJ' | 'CNI'
  ): OficioFinancialSummary {
    const grossAmount = dec(payment.grossAmount || payment.amount).toNumber()
    const operationType =
      (payment.operationType as 'PURE_RENTAL' | 'RENTAL_WITH_SERVICE') ||
      'PURE_RENTAL'

    return calculateOficioSummaryFromValues(
      grossAmount,
      rentalItems,
      serviceItems,
      settings,
      docType,
      operationType
    )
  }

  function calculateOficioSummaryFromValues(
    grossAmount: number,
    rentalItems: OficioRentalItem[],
    serviceItems: OficioServiceItem[],
    settings: TaxSettings,
    docType: 'CPF' | 'CNPJ' | 'CNI',
    operationType: 'PURE_RENTAL' | 'RENTAL_WITH_SERVICE'
  ): OficioFinancialSummary {
    const rentalTotal = rentalItems.reduce((sum, i) => sum + i.valor, 0)
    const serviceTotal = serviceItems.reduce((sum, i) => sum + i.valorTotal, 0)

    // Use actual item totals for bruto if they exist, otherwise use the payment gross
    const locacao = rentalTotal > 0 ? rentalTotal : grossAmount - serviceTotal
    const servicos = serviceTotal

    const gross = new Decimal(
      locacao + servicos > 0 ? locacao + servicos : grossAmount
    )
    const rentalDec = new Decimal(locacao > 0 ? locacao : gross.toNumber())
    const serviceDec = new Decimal(servicos)

    // Calculate full tax breakdown
    const breakdown = calculateTaxBreakdown({
      grossAmount: gross,
      operationType: serviceDec.gt(0) ? 'RENTAL_WITH_SERVICE' : operationType,
      rentalAmount: rentalDec,
      serviceAmount: serviceDec,
      taxDocumentType: docType,
      settings,
    })

    // Calculate per-section retention for display
    const retentionRate = getRetentionRate(docType, settings)
    const retencaoLocacao = rentalDec
      .mul(retentionRate)
      .div(100)
      .toDecimalPlaces(2)
      .toNumber()
    const retencaoLocacaoPercent = rentalDec.gt(0)
      ? retentionRate.toNumber()
      : 0

    // Service retention: ISS may apply on services
    let retencaoServicos = 0
    let retencaoServicosPercent = 0
    if (serviceDec.gt(0)) {
      retencaoServicos = serviceDec
        .mul(retentionRate)
        .div(100)
        .toDecimalPlaces(2)
        .toNumber()
      retencaoServicosPercent = retentionRate.toNumber()
    }

    const retencaoTotal = breakdown.retentionAmount.toNumber()
    const retencaoTotalPercent = breakdown.effectiveTaxRate.toNumber()

    return {
      bruto: gross.toNumber(),
      locacao: rentalDec.toNumber(),
      servicos: serviceDec.toNumber(),
      retencaoTotal,
      retencaoTotalPercent,
      retencaoLocacao,
      retencaoLocacaoPercent,
      retencaoServicos,
      retencaoServicosPercent,
      liquido: breakdown.netAmount.toNumber(),
    }
  }

  return { getCompanyInfo, mapPaymentToOficioData, mapQuoteToOficioData }
}
