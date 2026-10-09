import { createMaintenanceService } from '@gb-locacoes/backend/operations'
import {
  createMaintenanceHandlers,
  createAuditReadHandler,
} from '@gb-locacoes/backend/http'
import { withRentalTransaction } from '@/lib/rental-transaction'
import { getAuditLogs } from '@/lib/audit-log'
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
export const readAuditLogs = createAuditReadHandler({ getAuditLogs })
