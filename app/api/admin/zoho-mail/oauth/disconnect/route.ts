import { createZohoOAuthDisconnect } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from '@/lib/tenant'
import { requireAdminOrOperator } from '@/middlewares/require-admin'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function DELETE(request: Request) {
  const auth = await requireAdminOrOperator(request)
  if (!auth.success)
    return NextResponse.json(auth.body ?? { error: auth.error }, {
      status: auth.status,
      headers: auth.headers,
    })
  const { disconnectZohoOAuth } = createZohoOAuthDisconnect({
    withTenantTransaction,
  })
  return disconnectZohoOAuth(auth.principal, auth.user.id)
}
