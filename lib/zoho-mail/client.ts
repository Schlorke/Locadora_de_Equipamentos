import { createZohoMailClient } from '@gb-locacoes/backend/communications'
export const {
  isZohoOAuthConfigured,
  getZohoRedirectUri,
  getZohoOAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  makeZohoMailRequest,
  uploadZohoMailAttachments,
} = createZohoMailClient()
