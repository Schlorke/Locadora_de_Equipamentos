import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { requestClientRentalAction } from '@/lib/client-rental-requests'
import { RentalMutationError } from '@/lib/rental-transaction'
import { RentalExtensionRequestSchema } from '@gb-locacoes/contracts/rental-requests'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    const { id } = await params
    const data = RentalExtensionRequestSchema.safeParse(await request.json())
    if (!data.success)
      return NextResponse.json({ error: 'Prazo inválido' }, { status: 400 })
    const result = await requestClientRentalAction(
      access.principal,
      id,
      'EXTENSION',
      data.data.additionalDays
    )
    return NextResponse.json({
      success: true,
      message: 'Solicitação enviada à locadora',
      note: 'Aguarde a confirmação da equipe.',
      ...result,
    })
  } catch (error) {
    if (error instanceof RentalMutationError)
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
      { error: 'Não foi possível registrar a solicitação' },
      { status: 500 }
    )
  }
}
