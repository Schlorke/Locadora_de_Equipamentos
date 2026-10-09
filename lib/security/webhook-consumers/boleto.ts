import { createBoletoWebhookConsumer } from '@gb-locacoes/backend/billing'
import { withTenantTransaction } from '@/lib/tenant'
import { processPayment } from '@/lib/payment-processor'
import { resolveWebhookResource } from '@/lib/security/tenant-webhook'
import { convertPaidQuotePayment } from '@/lib/quote-payment-conversion'
export const { consumeWebhook } = createBoletoWebhookConsumer({
  withTenantTransaction,
  processPayment,
  resolveWebhookResource,
  convertPaidQuotePayment,
})
