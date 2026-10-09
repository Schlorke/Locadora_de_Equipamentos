import { createPaymentDocuments } from '@gb-locacoes/backend/billing'
import { withTenantTransaction } from '@/lib/tenant'
export const { readBoletoDocument } = createPaymentDocuments({
  withTenantTransaction,
})
