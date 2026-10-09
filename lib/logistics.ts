import { createDeliveryService } from '@gb-locacoes/backend/operations'
import { withTenantTransaction } from '@/lib/tenant'

export const { listDeliveries, createDelivery, updateDelivery } =
  createDeliveryService({ withTenantTransaction })
