import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireTenantPermission } from '@/lib/tenant-permissions'
import { requestBoletoReissue } from '@/lib/payment-reissue'
import { PaymentRequestError } from '@gb-locacoes/backend/billing'
import { UpdateFinancialDueDateSchema } from '@gb-locacoes/contracts/financial'
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireTenantPermission(request, 'FINANCIAL', 'WRITE')
    if (!access.ok) return access.response
    const { id } = await params
    const { dueDate } = UpdateFinancialDueDateSchema.parse(await request.json())
    const day = dueDate.toISOString().slice(0, 10)
    if (day < new Date().toISOString().slice(0, 10))
      return NextResponse.json(
        { error: 'O vencimento deve ser hoje ou uma data futura' },
        { status: 400 }
      )
    const operation = await requestBoletoReissue(access.principal, id, {
      dueDate: new Date(day + 'T12:00:00.000Z'),
    })
    return NextResponse.json(
      {
        ...operation,
        message:
          'Reemissão solicitada; o vencimento será atualizado após confirmação',
      },
      { status: 202 }
    )
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: 'Data inválida' }, { status: 400 })
    if (error instanceof PaymentRequestError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    return NextResponse.json(
      { error: 'Erro ao solicitar reemissão' },
      { status: 500 }
    )
  }
}
