import { requireTenantPermission } from '@/lib/tenant-permissions'
import {
  CatalogError,
  deleteCategory,
  updateCategory,
  type CategoryPatch,
} from '@/lib/catalog'
import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

const catalogFailure = (error: CatalogError) =>
  NextResponse.json({ error: error.message }, { status: error.status })

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const access = await requireTenantPermission(request, 'EQUIPMENTS', 'WRITE')
    if (!access.ok) return access.response
    // Corpo lido pelo serviço após confirmar que a categoria é da locadora.
    const category = await updateCategory(
      access.principal,
      params.id,
      () => request.json() as Promise<CategoryPatch>
    )
    return NextResponse.json(category)
  } catch (error) {
    if (error instanceof CatalogError) return catalogFailure(error)
    console.error('Error updating category:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar categoria' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  try {
    const access = await requireTenantPermission(
      request,
      'EQUIPMENTS',
      'DELETE'
    )
    if (!access.ok) return access.response
    await deleteCategory(access.principal, params.id)
    return NextResponse.json({ message: 'Categoria excluída' })
  } catch (error) {
    if (error instanceof CatalogError) return catalogFailure(error)
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir categoria' },
      { status: 500 }
    )
  }
}
