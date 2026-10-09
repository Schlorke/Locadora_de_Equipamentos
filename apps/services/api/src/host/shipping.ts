import { createShippingService } from '@gb-locacoes/backend/operations'
import { createShippingCalculationHandler } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from './tenant-transaction'
import { resolveIntegrationCredential } from './webhook-authentication'
export const calculateShipping = createShippingCalculationHandler(
  createShippingService({ withTenantTransaction, resolveIntegrationCredential })
)
