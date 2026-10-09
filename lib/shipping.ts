import { createShippingService } from '@gb-locacoes/backend/operations'
import { createShippingCalculationHandler } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from './tenant'
import { resolveIntegrationCredential } from './security/tenant-webhook'
export const calculateShipping = createShippingCalculationHandler(
  createShippingService({ withTenantTransaction, resolveIntegrationCredential })
)
