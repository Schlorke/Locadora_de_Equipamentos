import { type LucideIcon, Clock, CheckCircle, XCircle } from './status-icons'

// ─── Payment types ───────────────────────────────────────────────

export type QuotePaymentMetadata = {
  barcode?: string
  digitableLine?: string
  pdfUrl?: string
  boletoSentAt?: string
  boletoSentBy?: string
  boletoSentEmail?: string
}

export type QuotePayment = {
  id: string
  amount: number
  status: string
  method: string
  dueDate: string
  paidAt?: string | null
  metadata?: QuotePaymentMetadata | null
}

export type QuotePaymentTerms = 'UPFRONT' | 'ON_DELIVERY' | 'AT_END'

// ─── Quote types ─────────────────────────────────────────────────

export interface Quote {
  id: string
  quoteCode?: string | null
  legacyExternalCode?: string | null
  paymentTerms?: QuotePaymentTerms | null
  name: string
  email: string
  phone: string
  company?: string
  cpf?: string | null
  cnpj?: string | null
  cep?: string | null
  equipments: Array<{
    id: string
    name: string
    quantity: number
    dailyPrice: number
  }>
  startDate: string
  endDate: string
  totalPrice: number
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  message?: string
  deliveryType?: 'DELIVERY' | 'PICKUP' | null
  deliveryAddress?: {
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
    zipCode?: string
  } | null
  deliveryFee?: number | null
  pickupFee?: number | null
  address?: {
    street: string
    city: string
    state: string
    zipCode: string
  }
  createdAt: string
  updatedAt: string
  rejectedAt?: string | null
  rejectionReason?: string | null
  rejectedBy?: {
    id: string
    name: string | null
    image: string | null
  } | null
  approvedAt?: string | null
  originalTotal?: number
  finalTotal?: number | null
  priceAdjustmentReason?: string | null
  priceAdjustedAt?: string | null
  priceAdjustedBy?: string | null
  lateFee?: number | null
  lateFeeApproved?: boolean
  lateFeeApprovedAt?: string | null
  lateFeeApprovedBy?: string | null
  validUntil?: string | null
  customerImage?: string | null
  items?: Array<{
    id: string
    quantity: number
    days: number
    startDate?: string | null
    endDate?: string | null
    includeWeekends?: boolean
    appliedDiscount?: number | null
    appliedPeriod?: string | null
    useDirectValue?: boolean
    directValue?: number | null
    pricePerDay?: number
    total?: number
    equipment?: {
      id: string
      name: string
    }
  }>
  payments?: QuotePayment[]
  operationType?: 'PURE_RENTAL' | 'RENTAL_WITH_SERVICE' | null
  serviceAmount?: number | null
  [key: string]: unknown // Index signature para compatibilidade com KanbanItem
}

// ─── Price adjustment types ──────────────────────────────────────

export type PriceAdjustmentItem = {
  id: string
  category: '' | 'LABOR' | 'TRAVEL' | 'MAINTENANCE' | 'OTHER'
  categoryOther?: string
  value: number
  reason: string
}

export type QuoteAdjustmentFromApi = {
  id: string
  quoteId: string
  category: 'LABOR' | 'TRAVEL' | 'MAINTENANCE' | 'OTHER'
  amount: number
  justification: string
  createdAt?: string
  createdByUser?: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  } | null
}

// ─── Status config ───────────────────────────────────────────────

export const statusConfig: Record<
  string,
  {
    key: string
    label: string
    color: string
    icon: LucideIcon
    gradient: string
  }
> = {
  pending: {
    key: 'pending',
    label: 'Pendente',
    color: 'bg-orange-500 text-white shadow-sm border-0',
    icon: Clock,
    gradient: 'from-orange-400 to-orange-500',
  },
  approved: {
    key: 'approved',
    label: 'Aprovado',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
    gradient: 'from-green-400 to-emerald-500',
  },
  rejected: {
    key: 'rejected',
    label: 'Rejeitado',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
    gradient: 'from-red-400 to-rose-500',
  },
  completed: {
    key: 'completed',
    label: 'Concluido',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: CheckCircle,
    gradient: 'from-blue-400 to-blue-500',
  },
}

// ─── Adjustment labels ───────────────────────────────────────────

export const ADJUSTMENT_CATEGORY_LABEL: Record<
  'LABOR' | 'TRAVEL' | 'MAINTENANCE' | 'OTHER',
  string
> = {
  LABOR: 'Mão de obra',
  TRAVEL: 'Deslocamento (Frete)',
  MAINTENANCE: 'Manutenção',
  OTHER: 'Outro',
}

// ─── Factory helpers ─────────────────────────────────────────────

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
