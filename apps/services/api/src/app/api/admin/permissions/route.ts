import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import {
  readPermissionRows,
  replacePermissions,
} from '../../../../host/permission-rows'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const access = await resolveTenantPrincipal(request)
  if (!access.ok) return access.response
  if (access.principal.role !== 'ADMIN')
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  const permissions = await readPermissionRows(access.principal)
  return NextResponse.json({ permissions })
}

export async function PUT(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const context = access.principal
    if (context.role !== 'ADMIN')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    return await replacePermissions(context, request)
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    return NextResponse.json(
      { error: 'Erro ao atualizar permissões' },
      { status: 500 }
    )
  }
}
