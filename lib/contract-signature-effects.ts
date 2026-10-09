import { createContractSignatureEffects } from '@gb-locacoes/backend/documents'
import { withTenantTransaction } from '@/lib/tenant'
import { resolveIntegrationCredential } from '@/lib/security/tenant-webhook'
import { createZapSignDocument, getZapSignDocument } from '@/lib/zapsign'
import { getPrivateDocumentStorage } from '@/lib/security/private-documents'
export const {
  runContractSignatureEffect,
  runContractSignedArchiveEffect,
  reconcileContractSignature,
} = createContractSignatureEffects({
  withTenantTransaction,
  resolveIntegrationCredential,
  provider: {
    createDocument: createZapSignDocument,
    getDocument: getZapSignDocument,
  },
  getPrivateDocumentStorage,
})
