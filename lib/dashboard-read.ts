import { createDashboardRead } from '@gb-locacoes/backend/billing'
import { createDashboardReadHandlers } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from './tenant'
export const { readDashboard, readKPIs } = createDashboardReadHandlers(
  createDashboardRead({ withTenantTransaction })
)
