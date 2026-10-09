import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { listClientRentals } from '../../../../host/portal'

// GET - Obter locações do cliente logado
export async function GET(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const { searchParams } = new URL(request.url)
    const rentals = await listClientRentals(
      access.principal,
      searchParams.get('status')
    )
    return NextResponse.json({ rentals })
  } catch {
    console.error('Client portal operation failed')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
