import { NextResponse } from 'next/server'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { CustomerError } from '@gb-locacoes/backend/customers'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { writeCustomerCart } from '../../../../host/customers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function POST(request: Request) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    const body = await request.json()
    return NextResponse.json(
      await writeCustomerCart(access.principal, body.localCartItems, 'merge')
    )
  } catch (error) {
    if (error instanceof CustomerError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    return NextResponse.json(
      { error: 'Erro ao mesclar carrinho' },
      { status: 500 }
    )
  }
}
