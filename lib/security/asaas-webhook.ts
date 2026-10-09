import { createAsaasWebhookReceiver } from '@gb-locacoes/backend/http'
import { acceptConfiguredPlatformAsaasReceipt } from '@gb-locacoes/backend/runtime'
import { acceptQueuedAsaasWebhook } from './webhook-inbox'

export const receiveAsaasWebhook = createAsaasWebhookReceiver({
  acceptTenant: acceptQueuedAsaasWebhook,
  acceptPlatform: acceptConfiguredPlatformAsaasReceipt,
})
