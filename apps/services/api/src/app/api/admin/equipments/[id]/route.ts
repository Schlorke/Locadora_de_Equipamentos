import { CatalogError } from '@gb-locacoes/backend/catalog'
import { requireTenantPermission } from '../../../../../host/permissions'
import {
  deleteEquipment,
  readEquipment,
  updateEquipment,
} from '../../../../../host/catalog'
import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

const catalogFailure = (error: CatalogError) =>
  NextResponse.json({ error: error.message }, { status: error.status })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireTenantPermission(request, 'EQUIPMENTS', 'READ')
    if (!access.ok) return access.response
    const { id } = await params
    return NextResponse.json(await readEquipment(access.principal, id))
  } catch (error) {
    if (error instanceof CatalogError) return catalogFailure(error)
    console.error('Erro ao buscar equipamento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireTenantPermission(request, 'EQUIPMENTS', 'WRITE')
    if (!access.ok) return access.response
    const body = await request.json()
    const { id } = await params
    return NextResponse.json(await updateEquipment(access.principal, id, body))
  } catch (error) {
    if (error instanceof CatalogError) return catalogFailure(error)
    console.error('Erro ao atualizar equipamento:', error)

    if (process.env.NODE_ENV !== 'development')
      return NextResponse.json(
        {
          error: 'Erro interno do servidor',
          details: 'Erro interno do servidor',
        },
        { status: 500 }
      )

    let errorMessage = 'Erro interno do servidor'
    let details: string | undefined
    if (error instanceof Error) {
      errorMessage = error.message
      details = error.message
      console.error('Stack trace:', error.stack)
    } else {
      details = String(error)
    }
    const body = { error: errorMessage, details: details ?? errorMessage }

    return NextResponse.json(body, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
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
    await deleteEquipment(access.principal, id)
    return NextResponse.json({ message: 'Equipamento removido com sucesso' })
  } catch (error) {
    if (error instanceof CatalogError) return catalogFailure(error)
    console.error('Erro ao remover equipamento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
