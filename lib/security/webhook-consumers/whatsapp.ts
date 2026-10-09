import { createWhatsAppWebhookConsumer } from '@gb-locacoes/backend/communications'
import { withTenantTransaction } from '@/lib/tenant'
export const { consumeWebhook } = createWhatsAppWebhookConsumer({
  withTenantTransaction,
})
