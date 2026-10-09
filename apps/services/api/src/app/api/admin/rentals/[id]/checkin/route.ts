import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../../host/private-identity'
import { checkinRental } from '../../../../../../host/rentals'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { z } from 'zod'

import { CheckInSchema as CheckInSchema } from '@gb-locacoes/contracts/rentals'
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json(
      await checkinRental(
        principal,
        (await params).id,
        CheckInSchema.parse(await request.json())
      )
    )
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
    console.error('Error checking in rental:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
