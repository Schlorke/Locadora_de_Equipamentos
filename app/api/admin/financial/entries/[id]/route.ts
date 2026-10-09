import { NextResponse, type NextRequest } from 'next/server'
import { requireTenantPermission } from '@/lib/tenant-permissions'
import { inspectFinancialEntryDeletion } from '@/lib/financial-mutations'
export const runtime = 'nodejs'
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireTenantPermission(request, 'FINANCIAL', 'DELETE')
  if (!access.ok) return access.response
  const { id } = await params
  const decision = await inspectFinancialEntryDeletion(access.principal, id)
  if (decision === 'NOT_FOUND')
    return NextResponse.json(
      { error: 'Lançamento não encontrado' },
      { status: 404 }
    )
  return NextResponse.json(
    {
      error:
        'O histórico financeiro deve ser preservado. Utilize cancelamento e conciliação.',
      code: 'FINANCIAL_HISTORY_PRESERVED',
    },
    { status: 409 }
  )
}
