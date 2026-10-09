import { NextResponse } from 'next/server'
import { AddressInputSchema } from '@gb-locacoes/contracts/addresses'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { resolveTenantPrincipal } from '../../../host/private-identity'
import { createAddress, listAddresses } from '../../../host/customers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok) return access.response
  try {
    return NextResponse.json({
      addresses: await listAddresses(access.principal),
    })
  } catch {
    return NextResponse.json(
      { error: 'Erro ao buscar endereços' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok) return access.response
  const crossOrigin = rejectCrossOriginMutation(request)
  if (crossOrigin) return crossOrigin
  const input = AddressInputSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!input.success)
    return NextResponse.json(
      { error: 'Dados inválidos', details: input.error.issues },
      { status: 400 }
    )
  try {
    return NextResponse.json(
      { address: await createAddress(access.principal, input.data) },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Erro ao criar endereço' },
      { status: 500 }
    )
  }
}
