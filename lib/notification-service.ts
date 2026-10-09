import { createAdminNotificationService } from '@gb-locacoes/backend/communications'
import { withTenantTransaction } from '@/lib/tenant'
export const { getAdminUserIds, createAdminNotifications } =
  createAdminNotificationService({ withTenantTransaction })
