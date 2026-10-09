import { NextResponse } from 'next/server'
import { parseNotificationListQuery } from '@gb-locacoes/contracts/notifications'
import { listCustomerNotifications } from '@gb-locacoes/backend/communications'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { withTenantTransaction } from '../../../../host/tenant-transaction'

export async function GET(request: Request) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    return await withTenantTransaction(principal, async (tx) => {
      const { searchParams } = new URL(request.url)
      const parsed = parseNotificationListQuery({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        type: searchParams.get('type'),
        isRead: searchParams.get('isRead'),
      })
      if (!parsed.success)
        return NextResponse.json(
          { error: 'Parâmetros inválidos', details: parsed.error.issues },
          { status: 400 }
        )
      return NextResponse.json(
        await listCustomerNotifications(tx, principal, parsed.data)
      )
    })
  } catch {
    console.error('Client portal operation failed')
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
