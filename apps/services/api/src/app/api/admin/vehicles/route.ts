import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { requireTenantPermission } from '../../../../host/permissions'
import { createVehicle, listVehicles } from '../../../../host/operations'
import { VehicleError } from '@gb-locacoes/backend/operations'
import { CreateVehicleSchema } from '@gb-locacoes/contracts/operations'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const access = await requireTenantPermission(request, 'LOGISTICS', 'READ')
    if (!access.ok) return access.response
    const { searchParams } = new URL(request.url)
    return NextResponse.json({
      vehicles: await listVehicles(access.principal, {
        status: searchParams.get('status'),
        type: searchParams.get('type'),
      }),
    })
  } catch (error) {
    console.error('Error fetching vehicles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireTenantPermission(request, 'LOGISTICS', 'WRITE')
    if (!access.ok) return access.response
    const vehicle = await createVehicle(access.principal, async () =>
      CreateVehicleSchema.parse(await request.json())
    )
    return NextResponse.json({ vehicle }, { status: 201 })
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
    if (error instanceof VehicleError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    console.error('Error creating vehicle:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
