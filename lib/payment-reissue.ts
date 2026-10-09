import {
  createBoletoReissueRequest,
  createBoletoReissueWorker,
} from '@gb-locacoes/backend/billing'
import { withRentalTransaction } from '@/lib/rental-transaction'
import { processPayment } from '@/lib/payment-processor'
import { resolveIntegrationCredential } from '@/lib/security/tenant-webhook'
export const { requestBoletoReissue } = createBoletoReissueRequest({
  withRentalTransaction,
})
export const { runBoletoReissue } = createBoletoReissueWorker({
  withRentalTransaction,
  processPayment,
  resolveIntegrationCredential,
})
