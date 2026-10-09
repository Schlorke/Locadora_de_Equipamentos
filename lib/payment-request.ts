import { createPaymentRequests } from '@gb-locacoes/backend/billing'
import { withRentalTransaction } from '@/lib/rental-transaction'
import { readTenantProviderCharge } from '@/lib/payment-obligation'
import { resolveIntegrationCredential } from '@/lib/security/tenant-webhook'
export const { requestPayment } = createPaymentRequests({
  withRentalTransaction,
  readTenantProviderCharge,
  resolveIntegrationCredential,
})
