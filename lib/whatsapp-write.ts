import { createWhatsAppSendHandlers } from '@gb-locacoes/backend/http'
import { sendTextMessage } from './meta-whatsapp'
import { withTenantTransaction } from './tenant'
export const { sendTextRequest, sendConversationMessage } =
  createWhatsAppSendHandlers({ sendTextMessage, withTenantTransaction })
