import { createWhatsAppReader } from '@gb-locacoes/backend/communications'
import { createWhatsAppReadHandlers } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from './tenant-transaction'

export const { listConversations, readConversation, readMessages } =
  createWhatsAppReadHandlers({
    reader: createWhatsAppReader({ withTenantTransaction }),
  })
