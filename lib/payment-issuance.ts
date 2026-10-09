import { createPaymentIssuance } from '@gb-locacoes/backend/billing'
import { withRentalTransaction } from '@/lib/rental-transaction'
import { withTenantTransaction } from '@/lib/tenant'
import { resolveIntegrationCredential } from '@/lib/security/tenant-webhook'
export const { issueTenantPayment, scheduleIssuanceReconciliation } =
  createPaymentIssuance({
    withRentalTransaction,
    withTenantTransaction,
    resolveIntegrationCredential,
  })
