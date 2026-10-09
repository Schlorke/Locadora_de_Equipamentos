import {
  createPaymentRequests,
  createTenantProviderChargeReader,
  createPaymentDocuments,
  PaymentRequestError,
} from '@gb-locacoes/backend/billing'
import { createQuoteBoletos } from '@gb-locacoes/backend/quotations'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { createIntegrationCredentialResolver } from '@gb-locacoes/backend/runtime'
import { withTenantTransaction } from './tenant-transaction'
const { withRentalTransaction } = createRentalTransaction({
  withTenantTransaction,
})
const resolveIntegrationCredential = createIntegrationCredentialResolver()
const { readTenantProviderCharge } = createTenantProviderChargeReader({
  withTenantTransaction,
  resolveIntegrationCredential,
})
export const { requestPayment } = createPaymentRequests({
  withRentalTransaction,
  readTenantProviderCharge,
  resolveIntegrationCredential,
})
export const {
  ensureQuoteBoletoPayment,
  requestQuoteBoletoPayment,
  requestQuoteBoletoDelivery,
} = createQuoteBoletos({
  withTenantTransaction,
  withRentalTransaction,
  readProviderCharge: readTenantProviderCharge,
  obligationError: (status, message, policy) =>
    new PaymentRequestError(status, message, policy),
})
export const { readBoletoDocument } = createPaymentDocuments({
  withTenantTransaction,
})
