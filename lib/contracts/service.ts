import { createRentalContracts } from '@gb-locacoes/backend/documents'
import { createContractDownload } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from '@/lib/tenant'
import { resolveIntegrationCredential } from '@/lib/security/tenant-webhook'
import { getPrivateDocumentStorage } from '@/lib/security/private-documents'
export {
  ContractAccessError,
  canManageContracts,
} from '@gb-locacoes/backend/documents'
export const {
  generateRentalContract,
  readRentalContract,
  requestContractSignature,
} = createRentalContracts({
  withTenantTransaction,
  resolveIntegrationCredential,
})
export const { downloadRentalContract } = createContractDownload({
  withTenantTransaction,
  readRentalContract,
  getPrivateDocumentStorage,
})
