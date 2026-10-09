import Decimal from 'decimal.js'
import type { TaxDocumentType } from './tributo'

export type { TaxDocumentType }

export type FinancialRateSnapshot = {
  cpfRate: number
  cnpjRate: number
  cniRate: number
}

export const DEFAULT_FINANCIAL_RATES: FinancialRateSnapshot = {
  cpfRate: 6.0,
  cnpjRate: 2.5,
  cniRate: 6.0,
}

export type PaymentBillingStatus =
  'PAID' | 'UNPAID' | 'AWAITING_PAYMENT' | 'SETTLED'

export type PaymentStatus =
  'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED'

export function resolveTaxDocumentType(input: {
  cnpj?: string | null
  cpf?: string | null
  cni?: string | null
}): TaxDocumentType {
  if (input.cni?.trim()) return 'CNI'
  if (input.cnpj?.trim()) return 'CNPJ'
  return 'CPF'
}

export function getTaxRateByDocumentType(
  rates: FinancialRateSnapshot,
  documentType: TaxDocumentType
): number {
  switch (documentType) {
    case 'CNPJ':
      return rates.cnpjRate
    case 'CNI':
      return rates.cniRate
    case 'CPF':
      return rates.cpfRate
    default: {
      const unexpected: never = documentType
      void unexpected
      return rates.cpfRate
    }
  }
}

export function calculateNetAmount(
  grossAmount: number,
  taxRate: number
): number {
  const gross = new Decimal(grossAmount)
  const percentage = new Decimal(taxRate).div(100)
  return gross.minus(gross.mul(percentage)).toDecimalPlaces(2).toNumber()
}

export function mapPaymentStatusToBillingStatus(
  paymentStatus: PaymentStatus
): PaymentBillingStatus {
  switch (paymentStatus) {
    case 'PAID':
      return 'PAID'
    case 'OVERDUE':
      return 'UNPAID'
    case 'PENDING':
      return 'AWAITING_PAYMENT'
    case 'CANCELLED':
    case 'REFUNDED':
      return 'SETTLED'
    default: {
      const unexpected: never = paymentStatus
      void unexpected
      return 'AWAITING_PAYMENT'
    }
  }
}
