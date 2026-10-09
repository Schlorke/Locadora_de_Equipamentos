import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { readAuditLogs } from '../../../../host/maintenance'
export async function GET(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    if (access.principal.role !== 'ADMIN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return await readAuditLogs(access.principal, request)
  } catch {
    console.error('Audit log query failed')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
