import { updateDelivery } from '../../../../../host/operations'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { UpdateDeliverySchema } from '@gb-locacoes/contracts/operations'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const delivery = await updateDelivery(principal, id, async () =>
      UpdateDeliverySchema.parse(await request.json())
    )
    return NextResponse.json({ delivery })
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
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    console.error('Tenant operation failed')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
