import { NextResponse } from 'next/server'
import { CatalogError } from '@gb-locacoes/backend/catalog'
import { CreateCategorySchema as CategorySchema } from '@gb-locacoes/contracts/categories'
import { requireTenantPermission } from '../../../../host/permissions'
import { createCategory, listCategories } from '../../../../host/catalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

const catalogFailure = (error: CatalogError) =>
  NextResponse.json({ error: error.message }, { status: error.status })

export async function GET(request: Request) {
  try {
    const access = await requireTenantPermission(request, 'EQUIPMENTS', 'READ')
    if (!access.ok) return access.response
    return NextResponse.json(await listCategories(access.principal))
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar categorias' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireTenantPermission(request, 'EQUIPMENTS', 'WRITE')
    if (!access.ok) return access.response

    let raw
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    if (!raw.icon) delete raw.icon

    let parsed
    try {
      parsed = CategorySchema.parse(raw)
    } catch (err) {
      console.error('[CATEGORY_ERROR]', err)
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    return NextResponse.json(await createCategory(access.principal, parsed), {
      status: 201,
    })
  } catch (error) {
    if (error instanceof CatalogError) return catalogFailure(error)
    console.error('Error creating category:', error)

    if (error instanceof Error && 'code' in error) {
      const prismaError = error as Error & { code: string; meta?: unknown }
      console.error(
        '[API POST /admin/categories] Prisma error:',
        prismaError.code,
        error.message
      )

      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          { error: 'Categoria já existente' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Erro ao processar dados da categoria.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao criar categoria' },
      { status: 500 }
    )
  }
}
