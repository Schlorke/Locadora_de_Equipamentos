export interface Rental {
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
  createdat?: string
  users: {
    id: string
    name: string | null
    email: string
    phone: string | null
  }
  rental_items: Array<{
    id: string
    quantity: number
    totaldays: number
    totalprice: number
    equipments: {
      id: string
      name: string
      images: string[]
    }
  }>
  quote?: {
    id: string
    name: string
    email: string
    company?: string
    status?: string
  }
  payments?: Array<{
    id: string
    amount: number
    status: string
    method: string
    paidAt: string | null
  }>
  contract?: {
    id: string
    status: string
    signedAt?: string | null
    pdfUrl?: string | null
  }
  [key: string]: unknown
}

export type ClientDocumentType =
  'ID_DOCUMENT' | 'SELFIE' | 'SIGNED_CONTRACT' | 'CPF_CNPJ_PROOF'

export interface ClientDocument {
  id: string
  userId: string
  rentalId: string | null
  type: ClientDocumentType
  fileName: string
  mimeType: string
  fileSize: number
  createdAt: string
  signedUrl: string | null
}

export const requiredClientDocumentTypes: ClientDocumentType[] = [
  'ID_DOCUMENT',
  'SELFIE',
  'SIGNED_CONTRACT',
  'CPF_CNPJ_PROOF',
]

export const clientDocumentTypeLabel: Record<ClientDocumentType, string> = {
  ID_DOCUMENT: 'Documento de identidade',
  SELFIE: 'Selfie do cliente',
  SIGNED_CONTRACT: 'Contrato assinado',
  CPF_CNPJ_PROOF: 'CPF/CNPJ',
}

export const rentalStatusLabels: Record<string, string> &
  Record<
    | 'PENDING'
    | 'ACTIVE'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'OVERDUE'
    | 'PENDING_RETURN',
    string
  > = {
  PENDING: 'Pendente',
  ACTIVE: 'Ativa',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  OVERDUE: 'Atrasada',
  PENDING_RETURN: 'Aguardando Devolução',
}
