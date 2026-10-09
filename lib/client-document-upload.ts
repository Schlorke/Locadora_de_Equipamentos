import { createClientDocumentUpload } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from '@/lib/tenant'
import { getPrivateDocumentStorage } from '@/lib/security/private-documents'
export const { uploadRentalClientDocument } = createClientDocumentUpload({
  withTenantTransaction,
  getPrivateDocumentStorage,
})
