import { requireTenantPermission } from '../../../../../host/permissions'
import { readUnit, updateUnit, deleteUnit } from '../../../../../host/catalog'
import { CatalogError } from '@gb-locacoes/backend/catalog'
import { NextResponse } from 'next/server'
import { UpdateEquipmentUnitSchema as updateUnitSchema } from '@gb-locacoes/contracts/equipment-units'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

const catalogFailure = (error: CatalogError) =>
  NextResponse.json({ error: error.message }, { status: error.status })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireTenantPermission(request, 'EQUIPMENTS', 'READ')
    if (!access.ok) return access.response
    const { id } = await params
    return NextResponse.json(await readUnit(access.principal, id))
  } catch (error) {
    if (error instanceof CatalogError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    console.error('Erro ao buscar unidade:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar unidade' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireTenantPermission(request, 'EQUIPMENTS', 'WRITE')
    if (!access.ok) return access.response
    const { id } = await params
    const unit = await updateUnit(access.principal, id, async () =>
      updateUnitSchema.parse(await request.json())
    )
    return NextResponse.json(unit)
  } catch (error) {
    if (error instanceof CatalogError) return catalogFailure(error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Erro ao atualizar unidade:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar unidade' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireTenantPermission(
      request,
      'EQUIPMENTS',
      'DELETE'
    )
    if (!access.ok) return access.response
    const { id } = await params
    await deleteUnit(access.principal, id)
    return NextResponse.json({ message: 'Unidade deletada com sucesso' })
  } catch (error) {
    if (error instanceof CatalogError) return catalogFailure(error)
    console.error('Erro ao deletar unidade:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar unidade' },
      { status: 500 }
    )
  }
}
