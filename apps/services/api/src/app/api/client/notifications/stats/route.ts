import { readCustomerNotificationStats } from '@gb-locacoes/backend/communications'
import { NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { withTenantTransaction } from '../../../../../host/tenant-transaction'

/**
 * GET /api/client/notifications/stats
 * Retorna estatísticas de notificações do usuário
 */
export async function GET(request: Request) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    return await withTenantTransaction(principal, async (tx) => {
      return NextResponse.json(
        await readCustomerNotificationStats(tx, principal)
      )
    })
  } catch {
    console.error('Client portal operation failed')

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    )
  }
}
