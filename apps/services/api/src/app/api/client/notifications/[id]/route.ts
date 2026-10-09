import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { withTenantTransaction } from '../../../../../host/tenant-transaction'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import {
  markCustomerNotificationRead,
  deleteCustomerNotification,
} from '@gb-locacoes/backend/communications'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/client/notifications/[id]
 * Marcar notificação como lida
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    const principal = access.principal
    return await withTenantTransaction(principal, async (tx) => {
      const { id } = await params

      const updated = await markCustomerNotificationRead(tx, principal, id)
      if (!updated) {
        return NextResponse.json(
          { error: 'Notificação não encontrada' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        notification: updated,
      })
    })
  } catch {
    console.error('Client portal operation failed')
    const errorMessage = 'Erro interno do servidor'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

/**
 * DELETE /api/client/notifications/[id]
 * Deletar notificação
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    const principal = access.principal
    return await withTenantTransaction(principal, async (tx) => {
      const { id } = await params

      const removed = await deleteCustomerNotification(tx, principal, id)
      if (!removed) {
        return NextResponse.json(
          { error: 'Notificação não encontrada' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Notificação removida com sucesso',
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
