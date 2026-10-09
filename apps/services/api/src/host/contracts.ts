import {
  createRentalContracts,
  createZapSignWebhookConsumer,
  createContractSignatureEffects,
  createZapSignDocument,
  getZapSignDocument,
} from '@gb-locacoes/backend/documents'
import { createContractDownload } from '@gb-locacoes/backend/http'
import { getPrivateDocumentStorage } from './document-storage'
import { withTenantTransaction } from './tenant-transaction'
import {
  resolveIntegrationCredential,
  resolveWebhookResource,
} from './webhook-authentication'
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
export const { consumeWebhook: consumeZapSignWebhook } =
  createZapSignWebhookConsumer({
    withTenantTransaction,
    resolveWebhookResource,
  })

export { canManageContracts } from '@gb-locacoes/backend/documents'

export const { runContractSignatureEffect, runContractSignedArchiveEffect } =
  createContractSignatureEffects({
    withTenantTransaction,
    resolveIntegrationCredential,
    provider: {
      createDocument: createZapSignDocument,
      getDocument: getZapSignDocument,
    },
    getPrivateDocumentStorage,
  })
