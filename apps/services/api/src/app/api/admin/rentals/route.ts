import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { z } from 'zod'
import { createAdminRental, listAdminRentals } from '../../../../host/rentals'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'

import { CreateRentalSchema as CreateRentalSchema } from '@gb-locacoes/contracts/rentals'

// GET - Listar locações com filtros
export async function GET(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    return NextResponse.json(
      await listAdminRentals(principal, {
        status: searchParams.get('status'),
        userId: searchParams.get('userId'),
        startDate: searchParams.get('startDate'),
        endDate: searchParams.get('endDate'),
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '50'),
        includeOrphans: searchParams.get('includeOrphans') === 'true',
      })
    )
  } catch (error) {
    console.error('Error fetching rentals:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Criar nova locação
export async function POST(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const validatedData = CreateRentalSchema.parse(body)

    const rental = await createAdminRental(principal, validatedData)

    return NextResponse.json({ rental }, { status: 201 })
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
    console.error('Error creating rental:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
