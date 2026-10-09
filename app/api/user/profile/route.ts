import { NextRequest, NextResponse } from 'next/server'
import {
  createCustomerProfileService,
  CustomerError,
} from '@gb-locacoes/backend/customers'
import { resolveTenantPrincipal, withTenantTransaction } from '@/lib/tenant'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { CustomerProfileUpdateSchema } from '@gb-locacoes/contracts/customer-profile'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

// Composição: a transação por locadora vem de lib/tenant (identity + Prisma).
const profiles = createCustomerProfileService({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
})

const customerFailure = (error: CustomerError) =>
  NextResponse.json(error.policy ?? { error: error.message }, {
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

export async function PUT(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    const body = CustomerProfileUpdateSchema.safeParse(await request.json())
    if (!body.success)
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    const user = await profiles.updateCustomerProfile(
      access.principal,
      body.data
    )
    return NextResponse.json(
      { success: true, user },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    if (error instanceof CustomerError) return customerFailure(error)
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
    const user = await profiles.getCustomerProfile(access.principal)
    return NextResponse.json(
      { user },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    if (error instanceof CustomerError) return customerFailure(error)
    return NextResponse.json(
      { error: 'Erro ao buscar perfil' },
      { status: 500 }
    )
  }
}
