import { createWhatsAppClient } from '@gb-locacoes/backend/communications'
import { withTenantTransaction } from './tenant'
import { resolveIntegrationCredential } from './security/tenant-webhook'
export const { sendTextMessage } = createWhatsAppClient({
  withTenantTransaction,
  resolveIntegrationCredential,
})
