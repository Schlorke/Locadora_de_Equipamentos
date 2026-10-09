export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { RequestPaymentSchema as schema } from '@gb-locacoes/contracts/payments'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { requestPayment } from '../../../../host/payments'
import { PaymentRequestError } from '@gb-locacoes/backend/billing'

export async function POST(request: NextRequest) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok) return access.response
  try {
    const input = schema.parse(await request.json())
    const result = await requestPayment(access.principal, input, 'PIX')
    return NextResponse.json(
      {
        payment: {
          ...result.payment,
          amount: result.payment.amount.toString(),
        },
        processing: result.pending ? 'PENDING' : 'ISSUED',
        pixCode: result.payment.pixCode,
      },
      { status: result.pending ? 202 : 200 }
    )
  } catch (error) {
    if (error instanceof PaymentRequestError)
      return NextResponse.json(error.policy ?? { error: error.message }, {
        status: error.status,
        ...(error.policy
          ? {
              headers: {
                'Cache-Control': 'private, no-store',
                Vary: 'Cookie, Host',
              },
            }
          : {}),
      })
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        { error: 'Dados de cobrança inválidos' },
        { status: 400 }
      )
    return NextResponse.json(
      { error: 'Não foi possível solicitar a cobrança' },
      { status: 500 }
    )
  }
}
