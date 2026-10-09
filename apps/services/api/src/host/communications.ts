import {
  createAdminAlertSync,
  createAdminBadges,
  createZohoMailClient,
  createZohoMailConfiguration,
  createZohoMailTokenReader,
} from '@gb-locacoes/backend/communications'
import { withTenantTransaction } from './tenant-transaction'
const client = createZohoMailClient()
const configuration = createZohoMailConfiguration(process.env)
const tokens = createZohoMailTokenReader({
  withTenantTransaction,
  refreshAccessToken: client.refreshAccessToken,
  getZohoMailBaseUrl: configuration.getZohoMailBaseUrl,
})
export const { readAdminBadges } = createAdminBadges({
  withTenantTransaction,
  ...client,
  ...tokens,
})
export const { syncAdminAlerts } = createAdminAlertSync({
  withTenantTransaction,
})

import {
  createZohoMailListReader,
  createZohoMailMessageReader,
  createZohoMailContentReader,
} from '@gb-locacoes/backend/http'
export const { listAccounts, listFolders, listMessages } =
  createZohoMailListReader({ ...client, ...tokens })
export const { readMessage } = createZohoMailMessageReader({
  ...client,
  ...tokens,
  ...configuration,
})
export const { downloadAttachment, readInlineImage } =
  createZohoMailContentReader({ ...tokens, ...configuration })

import {
  createZohoMailSender,
  createZohoMailReplier,
  createZohoMailDraftWriter,
  createZohoMailUpdater,
  createZohoMailDeleter,
  createZohoMailAttachmentUploader,
  createMemoryIdempotencyCache,
} from '@gb-locacoes/backend/http'
import { createApplicationLogger } from '@gb-locacoes/backend/runtime'
import {
  checkRateLimit,
  strictRateLimit,
  adminApiRateLimit,
} from './rate-limit'
const idempotency = createMemoryIdempotencyCache()
const logger = createApplicationLogger(process.env)
export const { sendMessage } = createZohoMailSender({
  ...client,
  ...tokens,
  checkRateLimit,
  strictRateLimit,
  ...idempotency,
  withTenantTransaction,
  logger,
})
export const { replyMessage } = createZohoMailReplier({
  ...client,
  ...tokens,
  checkRateLimit,
  strictRateLimit,
  ...idempotency,
  withTenantTransaction,
  logger,
})
export const { saveDraft } = createZohoMailDraftWriter({
  withTenantTransaction,
  ...client,
  ...tokens,
  checkRateLimit,
  adminApiRateLimit,
})
export const { updateMessages } = createZohoMailUpdater({
  withTenantTransaction,
  ...client,
  ...tokens,
})
export const { deleteMessage } = createZohoMailDeleter({
  withTenantTransaction,
  ...client,
  ...tokens,
})
export const { uploadAttachments } = createZohoMailAttachmentUploader({
  withTenantTransaction,
  ...client,
  ...tokens,
  checkRateLimit,
  adminApiRateLimit,
})
