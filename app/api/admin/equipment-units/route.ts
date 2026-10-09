import { requireTenantPermission } from '@/lib/tenant-permissions'
import { CatalogError, createUnit, listUnits } from '@/lib/catalog'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { CreateEquipmentUnitSchema as createUnitSchema } from '@gb-locacoes/contracts/equipment-units'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

const catalogFailure = (error: CatalogError) =>
  NextResponse.json({ error: error.message }, { status: error.status })

// GET - Listar unidades (com filtros opcionais)
export async function GET(request: NextRequest) {
  try {
    const access = await requireTenantPermission(request, 'EQUIPMENTS', 'READ')
    if (!access.ok) return access.response
    const { searchParams } = new URL(request.url)
    return NextResponse.json(
      await listUnits(access.principal, {
        equipmentId: searchParams.get('equipmentId'),
        status: searchParams.get('status'),
        search: searchParams.get('search'),
      })
    )
  } catch (error) {
    console.error('Erro ao buscar unidades:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar unidades' },
      { status: 500 }
    )
  }
}

// POST - Criar nova unidade
export async function POST(request: NextRequest) {
  try {
    const access = await requireTenantPermission(request, 'EQUIPMENTS', 'WRITE')
    if (!access.ok) return access.response
    const validatedData = createUnitSchema.parse(await request.json())
    return NextResponse.json(
      await createUnit(access.principal, validatedData),
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof CatalogError) return catalogFailure(error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao criar unidade:', error)
    return NextResponse.json(
      { error: 'Erro ao criar unidade' },
      { status: 500 }
    )
  }
}
