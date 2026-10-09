import { createDelivery, listDeliveries } from '../../../../host/operations'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { CreateDeliverySchema } from '@gb-locacoes/contracts/operations'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { searchParams } = new URL(request.url)
    return NextResponse.json({
      deliveries: await listDeliveries(principal, {
        status: searchParams.get('status'),
        type: searchParams.get('type'),
        startDate: searchParams.get('startDate'),
        endDate: searchParams.get('endDate'),
      }),
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
    console.error('Tenant operation failed')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const delivery = await createDelivery(principal, async () =>
      CreateDeliverySchema.parse(await request.json())
    )
    return NextResponse.json({ delivery }, { status: 201 })
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
