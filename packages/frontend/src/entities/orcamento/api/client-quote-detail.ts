// Interface para orçamento não convertido
export interface ClientQuoteDetail {
  id: string
  quoteCode?: string | null
  legacyExternalCode?: string | null
  name: string
  email: string
  phone: string
  company?: string | null
  totalPrice: number
  originalTotal?: number
  finalTotal?: number | null
  priceAdjustmentReason?: string | null
  priceAdjustedAt?: string | null
  lateFee?: number | null
  lateFeeApproved?: boolean
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  deliveryType?: 'DELIVERY' | 'PICKUP' | null
  deliveryFee?: number | null
  pickupFee?: number | null
  deliveryAddress?: {
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    bairro?: string
    city?: string
    cidade?: string
    state?: string
    estado?: string
    zipCode?: string
    cep?: string
    logradouro?: string
  } | null
  createdAt: string
  updatedAt: string
  approvedAt?: string | null
  rejectedAt?: string | null
  validUntil?: string | null
  items?: Array<{
    id: string
    quantity: number
    days: number
    startDate?: string | null
    endDate?: string | null
    pricePerDay: number
    total: number
    appliedDiscount?: number | null
    appliedPeriod?: string | null
    useDirectValue?: boolean | null
    directValue?: number | null
    includeWeekends?: boolean | null
    equipment: {
      id: string
      name: string
      images?: string[]
      category?: {
        name: string
      }
    }
  }>
  payments?: Array<{
    id: string
    amount: number
    status: string
    method: string
    dueDate: string
    paidAt: string | null
    metadata?: {
      barcode?: string
      digitableLine?: string
      pdfUrl?: string
    } | null
  }>
  adjustments?: Array<{
    id: string
    category: string
    amount: number
    justification: string
  }>
}
