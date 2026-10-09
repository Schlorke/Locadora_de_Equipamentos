export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '../../../../../../host/private-identity'
import { readBoletoDocument } from '../../../../../../host/payments'
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok) return access.response
  const result = await readBoletoDocument(access.principal, (await params).id)
  if (result.kind === 'error')
    return NextResponse.json(result.body, { status: result.status })
  return NextResponse.redirect(result.url, {
    status: 302,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
