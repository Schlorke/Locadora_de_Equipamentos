import { NextResponse } from 'next/server'
import { createAdminAlertSync } from '@gb-locacoes/backend/communications'
import { withTenantTransaction } from '@/lib/tenant'
import { requireAdmin } from '@/middlewares/require-admin'
import {
  getAdminUserIds,
  createAdminNotifications,
} from '@/lib/notification-service'
export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.success)
    return NextResponse.json(authResult.body ?? { error: authResult.error }, {
      status: authResult.status,
      headers: authResult.headers,
    })
  const { syncAdminAlerts } = createAdminAlertSync({
    withTenantTransaction,
    notifications: { getAdminUserIds, createAdminNotifications },
  })
  return NextResponse.json(await syncAdminAlerts(authResult.principal))
}
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
