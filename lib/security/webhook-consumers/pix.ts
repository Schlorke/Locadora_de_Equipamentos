import { createPixWebhookConsumer } from '@gb-locacoes/backend/billing'
import { withTenantTransaction } from '@/lib/tenant'
import { processPayment } from '@/lib/payment-processor'
import { resolveWebhookResource } from '@/lib/security/tenant-webhook'

export const { consumeWebhook } = createPixWebhookConsumer({
  withTenantTransaction,
  processPayment,
  resolveWebhookResource,
})
