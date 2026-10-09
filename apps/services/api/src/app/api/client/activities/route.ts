import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { listClientActivities } from '../../../../host/portal'
import { CustomerError } from '@gb-locacoes/backend/customers'

export async function GET(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    return NextResponse.json(
      await listClientActivities(
        access.principal,
        new URL(request.url).searchParams.get('limit')
      )
    )
  } catch (error) {
    if (error instanceof CustomerError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
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
