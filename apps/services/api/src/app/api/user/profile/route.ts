import { NextRequest, NextResponse } from 'next/server'
import { CustomerError } from '@gb-locacoes/backend/customers'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { CustomerProfileUpdateSchema } from '@gb-locacoes/contracts/customer-profile'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import {
  getCustomerProfile,
  updateCustomerProfile,
} from '../../../../host/customers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function PUT(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    const body = CustomerProfileUpdateSchema.safeParse(await request.json())
    if (!body.success)
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    const user = await updateCustomerProfile(access.principal, body.data)
    return NextResponse.json(
      { success: true, user },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    if (error instanceof CustomerError)
      return NextResponse.json(error.policy ?? { error: error.message }, {
        status: error.status,
        ...(error.policy
          ? {
              headers: {
                'Cache-Control': 'private, no-store',
                Vary: 'Cookie, Host',
              },
            }
          : {}),
      })
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    )
      return NextResponse.json(
        { error: 'Documento já cadastrado nesta locadora' },
        { status: 409 }
      )
    return NextResponse.json(
      { error: 'Erro ao atualizar perfil' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const user = await getCustomerProfile(access.principal)
    return NextResponse.json(
      { user },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    if (error instanceof CustomerError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    return NextResponse.json(
      { error: 'Erro ao buscar perfil' },
      { status: 500 }
    )
  }
}
