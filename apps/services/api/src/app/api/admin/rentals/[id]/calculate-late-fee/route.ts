import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../../host/private-identity'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { applyRentalLateFee } from '../../../../../../host/rentals'

// POST - Calcular multa por atraso automaticamente
export async function POST(
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

    const result = await applyRentalLateFee(principal, id)
    if (result.outcome === 'not_found')
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 })
    if (result.outcome === 'not_overdue')
      return NextResponse.json({
        lateFee: 0,
        daysOverdue: 0,
        message: 'Rental is not overdue',
      })
    return NextResponse.json({
      rental: result.rental,
      lateFee: result.lateFee,
      daysOverdue: result.daysOverdue,
      message: 'Late fee calculated and applied successfully',
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
    console.error('Error calculating late fee:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
