import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../host/private-identity'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { listScheduledMaintenances } from '../../../../../host/maintenance'
export async function GET(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return await listScheduledMaintenances(principal, request)
  } catch (error) {
    if (error instanceof RentalMutationError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
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
