import { createClientDocumentService } from '@gb-locacoes/backend/customers'
import { withTenantTransaction } from '@/lib/tenant'

export {
  CustomerError,
  REQUIRED_CLIENT_DOCUMENT_TYPES,
} from '@gb-locacoes/backend/customers'
export type { RequiredClientDocumentType } from '@gb-locacoes/backend/customers'

// Dependências resolvidas na chamada: este módulo é importado pelo ciclo de
// locação, e o armazenamento privado (sharp/Supabase) só carrega na listagem.
export const { getMissingClientDocuments, listClientDocuments } =
  createClientDocumentService({
    withTenantTransaction: (context, operation) =>
      withTenantTransaction(context, operation),
    storage: {
      async open() {
        const documents = await import('@/lib/security/private-documents')
        const bucket = await documents.getPrivateDocumentStorage()
        return {
          isOwnedPath: documents.isOwnedDocumentPath,
          async signedUrl(filePath, fileName) {
            const signed = await bucket.createSignedUrl(
              filePath,
              documents.PRIVATE_DOCUMENT_URL_TTL,
              { download: fileName }
            )
            return signed.data?.signedUrl || null
          },
        }
      },
    },
  })
