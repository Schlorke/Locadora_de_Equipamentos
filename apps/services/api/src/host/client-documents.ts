import { createClientDocumentService } from '@gb-locacoes/backend/customers'
import { createClientDocumentUpload } from '@gb-locacoes/backend/http'
import {
  isOwnedDocumentPath,
  PRIVATE_DOCUMENT_URL_TTL,
} from '@gb-locacoes/backend/documents'
import { withTenantTransaction } from './tenant-transaction'
import { getPrivateDocumentStorage } from './document-storage'
const { listClientDocuments } = createClientDocumentService({
  withTenantTransaction,
  storage: {
    async open() {
      const bucket = await getPrivateDocumentStorage()
      return {
        isOwnedPath: isOwnedDocumentPath,
        async signedUrl(filePath, fileName) {
          const signed = await bucket.createSignedUrl(
            filePath,
            PRIVATE_DOCUMENT_URL_TTL,
            { download: fileName }
          )
          return signed.data?.signedUrl || null
        },
      }
    },
  },
})
export { listClientDocuments }
export const { uploadRentalClientDocument } = createClientDocumentUpload({
  withTenantTransaction,
  getPrivateDocumentStorage,
})
