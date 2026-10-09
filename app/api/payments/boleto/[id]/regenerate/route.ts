import { NextRequest, NextResponse } from 'next/server'
import { requireTenantPermission } from '@/lib/tenant-permissions'
import { requestBoletoReissue } from '@/lib/payment-reissue'
import { PaymentRequestError } from '@/lib/payment-obligation'
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireTenantPermission(request, 'FINANCIAL', 'WRITE')
  if (!access.ok) return access.response
  try {
    return NextResponse.json(
      await requestBoletoReissue(access.principal, (await params).id),
      { status: 202 }
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
      { error: 'Não foi possível solicitar a reemissão' },
      { status: 500 }
    )
  }
}
