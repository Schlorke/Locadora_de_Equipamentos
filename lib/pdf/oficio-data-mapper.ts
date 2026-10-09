import { createOficioMapper } from '@gb-locacoes/backend/documents'
import { withTenantTransaction } from '@/lib/tenant'
import { loadTenantBranding } from '@/lib/email-branding'
export const { getCompanyInfo, mapPaymentToOficioData, mapQuoteToOficioData } =
  createOficioMapper({ withTenantTransaction, loadTenantBranding })
