import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { z } from 'zod'
import { readAdminRental, updateRental } from '../../../../../host/rentals'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'

import { UpdateRentalSchema as UpdateRentalSchema } from '@gb-locacoes/contracts/rentals'

// GET - Obter locação específica
export async function GET(
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

    const rental = await readAdminRental(principal, id)

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 })
    }

    return NextResponse.json({ rental })
  } catch (error) {
    if (error instanceof RentalMutationError)
      return NextResponse.json(
        error.policy ?? {
          error: error.message,
          missingDocuments: error.missingDocuments,
        },
        {
          status: error.status,
          ...(error.policy
            ? {
                headers: {
                  'Cache-Control': 'private, no-store',
                  Vary: 'Cookie, Host',
                },
              }
            : {}),
        }
      )
    console.error('Error fetching rental:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Atualizar locação
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

    const body = await request.json()
    const validatedData = UpdateRentalSchema.parse(body)

    const rental = await updateRental(principal, id, validatedData)

    return NextResponse.json({ rental })
  } catch (error) {
    if (error instanceof RentalMutationError)
      return NextResponse.json(
        error.policy ?? {
          error: error.message,
          missingDocuments: error.missingDocuments,
        },
        {
          status: error.status,
          ...(error.policy
            ? {
                headers: {
                  'Cache-Control': 'private, no-store',
                  Vary: 'Cookie, Host',
                },
              }
            : {}),
        }
      )
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error updating rental:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Cancelar locação
export async function DELETE(
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

    await updateRental(principal, id, { status: 'CANCELLED' })

    return NextResponse.json({ message: 'Rental cancelled successfully' })
  } catch (error) {
    if (error instanceof RentalMutationError)
      return NextResponse.json(
        error.policy ?? {
          error: error.message,
          missingDocuments: error.missingDocuments,
        },
        {
          status: error.status,
          ...(error.policy
            ? {
                headers: {
                  'Cache-Control': 'private, no-store',
                  Vary: 'Cookie, Host',
                },
              }
            : {}),
        }
      )
    console.error('Error cancelling rental:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
