import { createWebhookInbox } from '@gb-locacoes/backend/outbox'
import { withTenantTransaction } from '@/lib/tenant'
export const {
  acceptTenantWebhook,
  acceptQueuedAsaasWebhook,
  runWebhookInboxEffect,
} = createWebhookInbox({
  withTenantTransaction,
  consumers: {
    PIX: () => import('./webhook-consumers/pix'),
    ASAAS: () => import('./webhook-consumers/boleto'),
    ZAPSIGN: () => import('./webhook-consumers/zapsign'),
    WHATSAPP: () => import('./webhook-consumers/whatsapp'),
  },
})
