import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { listClientRentals } from '@/lib/client-rental-requests'

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
