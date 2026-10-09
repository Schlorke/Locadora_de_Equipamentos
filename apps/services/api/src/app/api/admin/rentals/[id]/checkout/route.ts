import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../../host/private-identity'
import { checkoutRental } from '../../../../../../host/rentals'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'

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

    return NextResponse.json({
      rental: await checkoutRental(principal, (await params).id),
    })
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
    console.error('Error checking out rental:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
