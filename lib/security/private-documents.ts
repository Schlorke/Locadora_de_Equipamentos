import { createPrivateDocumentStorage } from '@gb-locacoes/backend/documents'
export {
  PRIVATE_DOCUMENT_URL_TTL,
  InvalidDocumentError,
  isOwnedDocumentPath,
} from '@gb-locacoes/backend/documents'
export const { getPrivateDocumentStorage } = createPrivateDocumentStorage({
  async getClient() {
    const { supabaseAdmin } = await import('@/lib/supabase-admin')
    return supabaseAdmin
  },
})
