import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { readBoletoDocument } from '@/lib/payment-documents'
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
