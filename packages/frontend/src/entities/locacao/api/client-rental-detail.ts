export interface ClientRentalDetail {
  id: string
  startdate: string
  enddate: string
  total: number
  status: string
  lateFee?: number
  extensionDays?: number
  checkInAt?: string
  checkOutAt?: string
  notes?: string
  rental_items: Array<{
    id: string
    quantity: number
    totaldays: number
    totalprice: number
    priceperday?: number
    equipments: {
      id: string
      name: string
      images: string[]
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
  deliveries?: Array<{
    id: string
    type: string
    status: string
    scheduledAt: string
    completedAt: string | null
    address: {
      street?: string
      city?: string
      state?: string
    }
  }>
  quote?: {
    id: string
    name: string
    email: string
    total?: number | null
    finalTotal?: number | null
    deliveryType?: string | null
    deliveryFee?: number | null
    pickupFee?: number | null
    deliveryAddress?: {
      street?: string
      number?: string
      complement?: string
      neighborhood?: string
      city?: string
      state?: string
      zipCode?: string
    } | null
    items?: Array<{
      id: string
      quantity?: number | null
      days?: number | null
      pricePerDay?: number | null
      total?: number | null
      appliedDiscount?: number | null
      appliedPeriod?: string | null
      useDirectValue?: boolean | null
      directValue?: number | null
      startDate?: string | null
      endDate?: string | null
      includeWeekends?: boolean | null
      equipment: {
        id: string
        name: string
      }
    }>
  }
  contract?: {
    id: string
    pdfUrl: string | null
    status: string
    signedAt: string | null
    zapSignId: string | null
  }
}
