import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import {
  CustomerError,
  readCustomerCart,
  writeCustomerCart,
} from '@/lib/cart-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

function failed(error: unknown) {
  if (error instanceof CustomerError)
    return NextResponse.json({ error: error.message }, { status: error.status })
  return NextResponse.json(
    { error: 'Erro ao sincronizar carrinho' },
    { status: 500 }
  )
}
export async function GET(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    return NextResponse.json(
      (await readCustomerCart(access.principal)) ?? { items: [] }
    )
  } catch (error) {
    return failed(error)
  }
}
export async function POST(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    const body = await request.json()
    await writeCustomerCart(access.principal, body.items, 'replace')
    return NextResponse.json({ message: 'Carrinho sincronizado com sucesso' })
  } catch (error) {
    return failed(error)
  }
}
