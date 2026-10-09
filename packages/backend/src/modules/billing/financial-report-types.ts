export type ExportRow = {
  quoteCode: string
  legacyCode: string
  customerName: string
  customerCompany: string
  customerDocument: string
  grossAmount: number
  netAmount: number
  taxRate: number
  invoiceNumber: string
  boletoIssuedAt: string
  invoiceIssuedAt: string
  dueDate: string
  dueDateRaw: Date | null
  paidAt: string
  billingStatus: string
  billingStatusLabel: string
  operationType: string
  taxRegime: string
  taxDocumentType: string
  issAmount: number
}
