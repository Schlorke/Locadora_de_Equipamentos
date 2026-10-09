import { NextResponse } from 'next/server'
import { AddressPatchSchema } from '@gb-locacoes/contracts/addresses'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import {
  updateAddress,
  deleteAddress,
  AddressNotFound,
} from '../../../../host/customers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok) return access.response
  const crossOrigin = rejectCrossOriginMutation(request)
  if (crossOrigin) return crossOrigin
  const input = AddressPatchSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!input.success)
    return NextResponse.json(
      { error: 'Dados inválidos', details: input.error.issues },
      { status: 400 }
    )
  try {
    return NextResponse.json({
      address: await updateAddress(
        access.principal,
        (await params).id,
        input.data
      ),
    })
  } catch (error) {
    return failure(error)
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok) return access.response
  const crossOrigin = rejectCrossOriginMutation(request)
  if (crossOrigin) return crossOrigin
  try {
    await deleteAddress(access.principal, (await params).id)
    return NextResponse.json({ message: 'Endereço removido com sucesso' })
  } catch (error) {
    return failure(error)
  }
}

function failure(error: unknown) {
  return error instanceof AddressNotFound
    ? NextResponse.json({ error: 'Endereço não encontrado' }, { status: 404 })
    : NextResponse.json(
        { error: 'Não foi possível alterar o endereço' },
        { status: 500 }
      )
}
