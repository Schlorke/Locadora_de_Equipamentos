import { createQuoteBoletos } from '@gb-locacoes/backend/quotations'
import { withTenantTransaction } from '@/lib/tenant'
import { withRentalTransaction } from '@/lib/rental-transaction'
import {
  PaymentRequestError,
  readTenantProviderCharge,
} from '@/lib/payment-obligation'

export type { QuoteBoletoInfo } from '@gb-locacoes/backend/quotations'

/**
 * Creates the obligation and its durable issuance request. No provider call runs in SQL: a
 * CANCELLED PIX/boleto without proof of its end is read at the provider (tenant's single ACTIVE
 * Asaas integration) between two transactions and reconciled before any new boleto.
 */
export const {
  ensureQuoteBoletoPayment,
  requestQuoteBoletoPayment,
  requestQuoteBoletoDelivery,
} = createQuoteBoletos({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
  withRentalTransaction,
  obligationError: (status, message, policy) =>
    new PaymentRequestError(status, message, policy),
  readProviderCharge: readTenantProviderCharge,
})
