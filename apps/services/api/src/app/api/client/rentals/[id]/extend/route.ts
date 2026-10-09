import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../../host/private-identity'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { extendRental } from '../../../../../../host/rentals'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { z } from 'zod'

import { ClientExtendRentalSchema as ExtendRentalSchema } from '@gb-locacoes/contracts/rentals'

// POST - Solicitar prorrogação de locação
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    const principal = access.principal

    const body = await request.json()
    const validatedData = ExtendRentalSchema.parse(body)

    const result = await extendRental(principal, id, {
      additionalDays: validatedData.extensionDays,
      customerId: principal.userId,
    })
    return NextResponse.json({
      ...result,
      message: 'Prorrogação solicitada com sucesso',
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error extending rental:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
