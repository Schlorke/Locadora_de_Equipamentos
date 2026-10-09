import { NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { withTenantTransaction } from '../../../../../host/tenant-transaction'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { markAllCustomerNotificationsRead } from '@gb-locacoes/backend/communications'

/**
 * POST /api/client/notifications/mark-all-read
 * Marcar todas as notificações como lidas
 */
export async function POST(request: Request) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    const principal = access.principal
    return await withTenantTransaction(principal, async (tx) => {
      const count = await markAllCustomerNotificationsRead(tx, principal)

      return NextResponse.json({
        success: true,
        updated: count,
        message: `${count} notificação(ões) marcada(s) como lida(s)`,
      })
    })
  } catch {
    console.error('Client portal operation failed')
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
