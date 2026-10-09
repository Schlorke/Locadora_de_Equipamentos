import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantPermission } from '@/lib/tenant-permissions'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { updateFinancialStatus } from '@/lib/financial-mutations'
import { UpdateFinancialStatusSchema } from '@gb-locacoes/contracts/financial'
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireTenantPermission(request, 'FINANCIAL', 'WRITE')
    if (!access.ok) return access.response
    const context = access.principal
    const { id } = await params
    const input = UpdateFinancialStatusSchema.parse(await request.json())
    const entry = await updateFinancialStatus(context, id, input)
    return NextResponse.json({ entry })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
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
    return NextResponse.json(
      { error: 'Erro ao atualizar status financeiro' },
      { status: 500 }
    )
  }
}
