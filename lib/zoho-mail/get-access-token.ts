import { createZohoMailTokenReader } from '@gb-locacoes/backend/communications'
import { withTenantTransaction } from '@/lib/tenant'
import { refreshAccessToken } from './client'
import { getZohoMailBaseUrl } from './constants'
export const { getZohoAccessToken, getZohoAccountId } =
  createZohoMailTokenReader({
    withTenantTransaction,
    refreshAccessToken,
    getZohoMailBaseUrl,
  })
