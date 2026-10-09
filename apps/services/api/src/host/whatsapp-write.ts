import {
  createWhatsAppClient,
  createWhatsAppWebhookConsumer,
} from '@gb-locacoes/backend/communications'
import { createWhatsAppSendHandlers } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from './tenant-transaction'
import { resolveIntegrationCredential } from './webhook-authentication'

const client = createWhatsAppClient({
  withTenantTransaction,
  resolveIntegrationCredential,
})
export const { sendTextRequest, sendConversationMessage } =
  createWhatsAppSendHandlers({ ...client, withTenantTransaction })
export const { consumeWebhook: consumeWhatsAppWebhook } =
  createWhatsAppWebhookConsumer({ withTenantTransaction })
