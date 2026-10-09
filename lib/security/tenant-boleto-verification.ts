import {
  createTenantBoletoVerifier,
  createBoletoVerificationService,
} from '@gb-locacoes/backend/billing'
import { withTenantTransaction } from '@/lib/tenant'
import { withRentalTransaction } from '@/lib/rental-transaction'
import { processPayment } from '@/lib/payment-processor'
import { convertPaidQuotePayment } from '@/lib/quote-payment-conversion'
import { resolveIntegrationCredential } from './tenant-webhook'
export const { verifyTenantBoleto } = createTenantBoletoVerifier({
  withTenantTransaction,
  resolveIntegrationCredential,
})
export const { verifyBoletoPayment } = createBoletoVerificationService({
  withTenantTransaction,
  withRentalTransaction,
  verifyTenantBoleto,
  processPayment,
  convertPaidQuotePayment,
})
