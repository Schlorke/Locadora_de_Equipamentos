import { createZapSignWebhookConsumer } from '@gb-locacoes/backend/documents'
import { withTenantTransaction } from '@/lib/tenant'
import { resolveWebhookResource } from '@/lib/security/tenant-webhook'
export const { consumeWebhook } = createZapSignWebhookConsumer({
  withTenantTransaction,
  resolveWebhookResource,
})
