import { NextRequest, NextResponse } from 'next/server'
import { requireTenantPermission } from '@/lib/tenant-permissions'
import { requestQuoteBoletoPayment } from '@/lib/quote-boleto'
import { PaymentRequestError } from '@/lib/payment-obligation'
import { checkRateLimit, strictRateLimit } from '@/lib/rate-limit'
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limit = checkRateLimit(request, strictRateLimit)
  if (!limit.allowed) return limit.response
  const access = await requireTenantPermission(request, 'FINANCIAL', 'WRITE')
  if (!access.ok) return access.response
  try {
    const boleto = await requestQuoteBoletoPayment(
      access.principal,
      (await params).id
    )
    return NextResponse.json(
      { success: true, boleto, processing: boleto.processing },
      { status: boleto.processing === 'PENDING' ? 202 : 200 }
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
    return NextResponse.json(
      { error: 'Não foi possível solicitar o boleto' },
      { status: 500 }
    )
  }
}
