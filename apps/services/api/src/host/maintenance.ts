import {
  createMaintenanceService,
  createAuditReadService,
} from '@gb-locacoes/backend/operations'
import {
  createMaintenanceHandlers,
  createAuditReadHandler,
} from '@gb-locacoes/backend/http'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { withTenantTransaction } from './tenant-transaction'
const { withRentalTransaction } = createRentalTransaction({
  withTenantTransaction,
})
export const {
  listMaintenances,
  createMaintenance,
  listScheduledMaintenances,
  schedulePreventiveMaintenance,
  updateMaintenance,
  completeMaintenance,
} = createMaintenanceHandlers(
  createMaintenanceService({ withRentalTransaction })
)
export const readAuditLogs = createAuditReadHandler(
  createAuditReadService({ withTenantTransaction })
)
