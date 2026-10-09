import { createTenantBranding } from '@gb-locacoes/backend/communications'
import { withTenantTransaction } from '@/lib/tenant'
export { TenantBrandingError } from '@gb-locacoes/backend/communications'
export const { loadTenantBranding } = createTenantBranding({
  withTenantTransaction,
})
