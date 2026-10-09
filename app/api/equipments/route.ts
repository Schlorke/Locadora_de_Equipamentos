import { publicCacheHeaders, resolvePublicRequestTenant } from '@/lib/tenant'
import { listPublicEquipments } from '@/lib/catalog'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

/**
 * Lista equipamentos da locadora selecionada.
 * @description tenantSlug obrigatório. Sem locadora padrão; recursos de outras locadoras não são retornados.
 * @tag Equipments
 * @query PublicTenantQuery
 * @response 200: PublicEquipmentList: Catálogo da locadora
 * @response 404:PublicApiError: Locadora inexistente ou inativa
 * @response 409:PublicApiError: Selecione uma locadora
 * @openapi
 */
export async function GET(request: Request) {
  try {
    const tenant = await resolvePublicRequestTenant(request)
    if (!tenant.ok) return tenant.response
    return NextResponse.json(await listPublicEquipments(tenant.context), {
      headers: publicCacheHeaders(
        tenant.edge,
        'public, max-age=60, stale-while-revalidate=300'
      ),
    })
  } catch {
    return NextResponse.json(
      { error: 'Erro ao buscar equipamentos' },
      { status: 500 }
    )
  }
}
