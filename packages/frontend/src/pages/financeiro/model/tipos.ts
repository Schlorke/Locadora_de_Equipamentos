export type FinancialCalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  color: string
  type: 'rental'
  status: string
  resourceId: string
  equipmentName: string
  metadata: Record<string, unknown>
}

export interface AgingData {
  range: string
  amount: number
  count: number
  status:
    | 'current'
    | 'slight'
    | 'moderate'
    | 'severe'
    | 'critical'
    | 'onTime'
    | 'slightDelay'
    | 'severeDelay'
}

export interface Debtor {
  clientName: string
  overdueAmount: number
  daysOverdue: number
  status: 'overdue' | 'attention' | 'critical'
}

export interface RevenueData {
  month: string
  revenue: number
}

export interface CategoryRevenue {
  categoryName: string
  revenue: number
}

export type BillingStatus = 'PAID' | 'UNPAID' | 'AWAITING_PAYMENT' | 'SETTLED'

export type FinancialEntry = {
  id: string
  rentalId?: string | null
  quoteId: string | null
  quoteCode: string | null
  legacyExternalCode: string | null
  customerName: string
  customerEmail: string | null
  customerDocument: string
  grossAmount: number
  netAmount: number
  taxRate: number
  taxDocumentType: 'CPF' | 'CNPJ' | 'CNI'
  invoiceNumber: string | null
  boletoIssuedAt: string | null
  invoiceIssuedAt: string | null
  dueDate: string
  paidAt: string | null
  settledAt: string | null
  billingStatus: BillingStatus
  // Tax compliance fields (null for legacy entries)
  operationType?: string | null
  rentalAmount?: number | null
  serviceAmount?: number | null
  taxRegimeSnapshot?: string | null
  issAmount?: number | null
  irpjAmount?: number | null
  csllAmount?: number | null
  pisCofinsAmount?: number | null
  simplesAmount?: number | null
  taxBreakdown?: Array<{
    label: string
    baseAmount: string
    rate: string
    amount: string
    exempt: boolean
  }> | null
}

export const statusLabel: Record<BillingStatus, string> = {
  PAID: 'Pago',
  UNPAID: 'Não Pago',
  AWAITING_PAYMENT: 'Aguardando Pagamento',
  SETTLED: 'Baixado',
}

/** Estilo unificado dos badges (igual ao "PAGAMENTO PENDENTE" do header): rounded-full px-2 py-0.5 text-[9px] sm:px-2.5 sm:text-[10px] font-semibold uppercase tracking-wider shadow-sm */
export const statusBadgeClass: Record<BillingStatus, string> = {
  PAID: 'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider shadow-sm sm:px-2.5 sm:text-[10px] bg-emerald-500 text-white hover:bg-emerald-600',
  UNPAID:
    'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider shadow-sm sm:px-2.5 sm:text-[10px] bg-red-500 text-white hover:bg-red-600',
  AWAITING_PAYMENT:
    'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider shadow-sm sm:px-2.5 sm:text-[10px] bg-orange-500 text-white hover:bg-orange-600',
  SETTLED:
    'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider shadow-sm sm:px-2.5 sm:text-[10px] bg-slate-500 text-white hover:bg-slate-600',
}

export type TaxRegime = 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'

export type FinancialSettings = {
  cpfRate: number
  cnpjRate: number
  cniRate: number
  taxRegime: TaxRegime
  issRate: number
  issExemptRental: boolean
  irpjPresumidoRate: number | null
  csllPresumidoRate: number | null
  pisCofinsRate: number | null
  simplesAliquota: number | null
  ibsCbsRate: number | null
  ibsCbsActive: boolean
}

export const REGIME_LABELS: Record<TaxRegime, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
}

export const OPERATION_TYPE_LABELS: Record<string, string> = {
  PURE_RENTAL: 'Locação Pura',
  RENTAL_WITH_SERVICE: 'Locação + Serviço',
}

export const ADJUSTMENT_CATEGORY_LABELS: Record<string, string> = {
  LABOR: 'Mão de Obra',
  TRAVEL: 'Deslocamento',
  MAINTENANCE: 'Manutenção',
  OTHER: 'Outros',
}

export type PriceAdjustmentItem = {
  id: string
  category: '' | 'LABOR' | 'TRAVEL' | 'MAINTENANCE' | 'OTHER'
  categoryOther?: string
  value: number
  reason: string
}

export function createDefaultAdjustmentItem(
  overrides?: Partial<PriceAdjustmentItem>
): PriceAdjustmentItem {
  return {
    id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    category: '',
    value: 0,
    reason: '',
    ...overrides,
  }
}

export type FinancialTotals = {
  gross: number
  net: number
  paid: number
  paidNet: number
  paidCount: number
  unpaid: number
  unpaidCount: number
  awaiting: number
  awaitingCount: number
  count: number
}

export const DEFAULT_FINANCIAL_TOTALS: FinancialTotals = {
  gross: 0,
  net: 0,
  paid: 0,
  paidNet: 0,
  paidCount: 0,
  unpaid: 0,
  unpaidCount: 0,
  awaiting: 0,
  awaitingCount: 0,
  count: 0,
}

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  cpfRate: 6,
  cnpjRate: 2.5,
  cniRate: 6,
  taxRegime: 'SIMPLES_NACIONAL',
  issRate: 2.5,
  issExemptRental: true,
  irpjPresumidoRate: null,
  csllPresumidoRate: null,
  pisCofinsRate: null,
  simplesAliquota: null,
  ibsCbsRate: null,
  ibsCbsActive: false,
}

export type AdjustmentHistoryItem = {
  id: string
  category: string
  amount: number
  justification: string
  createdAt: string
  createdByUser?: {
    name: string | null
    email: string | null
    image: string | null
  } | null
  sentEmailAt?: string | null
}
