import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { RentalMutationError } from '@/lib/rental-transaction'
import { requestAdjustedQuoteDelivery } from '@/lib/quote-request'

export const runtime = 'nodejs'
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const context = access.principal
    if (!['ADMIN', 'OPERATOR'].includes(context.role))
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    const { id } = await params
    await requestAdjustedQuoteDelivery(context, id)
    return NextResponse.json(
      { success: true, emailStatus: 'queued' },
      { status: 202 }
    )
  } catch (error) {
    if (error instanceof RentalMutationError)
      return NextResponse.json(
        error.policy ?? { error: error.message, code: error.code },
        {
          status: error.status,
          ...(error.policy
            ? {
                headers: {
                  'Cache-Control': 'private, no-store',
                  Vary: 'Cookie, Host',
                },
              }
            : {}),
        }
      )
    console.error('Quote adjustment notification failed')
    return NextResponse.json(
      { error: 'Erro ao solicitar envio' },
      { status: 500 }
    )
  }
}
