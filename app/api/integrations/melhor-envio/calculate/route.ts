import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { calculateShipping } from '@/lib/shipping'
export async function POST(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    return await calculateShipping(access.principal, request)
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível consultar o frete' },
      { status: 502 }
    )
  }
}
