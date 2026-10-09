import { NextResponse } from 'next/server'
import { requireTenantPermission } from '../../../../../../../host/permissions'
import { hasQuoteAdjustment } from '../../../../../../../host/quotations'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; adjustmentId: string }> }
) {
  try {
    const access = await requireTenantPermission(request, 'QUOTES', 'WRITE')
    if (!access.ok) return access.response
    const { id: quoteId, adjustmentId } = await params
    if (!(await hasQuoteAdjustment(access.principal, quoteId, adjustmentId)))
      return NextResponse.json(
        { error: 'Reajuste não encontrado' },
        { status: 404 }
      )
    return NextResponse.json(
      {
        error:
          'O histórico de reajustes deve ser preservado. Registre uma revisão financeira para corrigir valores.',
        code: 'ADJUSTMENT_HISTORY_PRESERVED',
      },
      { status: 409 }
    )
  } catch (error) {
    console.error('Erro ao consultar reajuste:', error)
    return NextResponse.json(
      { error: 'Erro ao consultar reajuste' },
      { status: 500 }
    )
  }
}
