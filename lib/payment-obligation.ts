import { createTenantProviderChargeReader } from '@gb-locacoes/backend/billing'
import { withTenantTransaction } from '@/lib/tenant'
import { resolveIntegrationCredential } from '@/lib/security/tenant-webhook'
export { PaymentRequestError } from '@gb-locacoes/backend/billing'
export const { readTenantProviderCharge } = createTenantProviderChargeReader({
  withTenantTransaction,
  resolveIntegrationCredential,
})
