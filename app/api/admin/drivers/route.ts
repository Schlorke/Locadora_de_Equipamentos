import { RentalMutationError } from '@/lib/rental-transaction'
import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { createDriver, listDrivers } from '@/lib/drivers'
import { z } from 'zod'
import type { DriverStatus } from '@prisma/client'
import { CreateDriverSchema } from '@gb-locacoes/contracts/drivers'

export async function GET(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    if (access.principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const status = new URL(request.url).searchParams.get('status')
    return NextResponse.json({
      drivers: await listDrivers(
        access.principal,
        (status || undefined) as DriverStatus | undefined
      ),
    })
  } catch {
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
    if (access.principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const input = CreateDriverSchema.parse(await request.json())
    return NextResponse.json(
      { driver: await createDriver(access.principal, input) },
      { status: 201 }
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
    console.error('Tenant operation failed')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
