export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { VerifyBoletoSchema } from '@gb-locacoes/contracts/payments'
import { requireTenantPermission } from '../../../../../host/permissions'
import { verifyBoletoPayment } from '../../../../../host/payment-webhooks'
export async function POST(request: NextRequest) {
  const access = await requireTenantPermission(request, 'FINANCIAL', 'WRITE')
  if (!access.ok) return access.response
  try {
    const { paymentId } = VerifyBoletoSchema.parse(await request.json())
    return await verifyBoletoPayment(access.principal, paymentId)
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    return NextResponse.json(
      { error: 'Não foi possível conciliar a cobrança' },
      { status: 503 }
    )
  }
}
