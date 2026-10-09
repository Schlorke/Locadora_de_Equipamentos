import type { createPublicCatalog } from '../modules/catalog/index'
import {
  publicCacheHeaders,
  type PublicRequestTenant,
} from '../modules/identity/index'

const EQUIPMENT_ID = /^[A-Za-z0-9_-]{1,128}$/
const notFound = () =>
  Response.json(
    { error: 'Equipamento não encontrado' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } }
  )

export function createPublicEquipmentDetailHandler(deps: {
  resolveTenant: (_request: Request) => Promise<PublicRequestTenant>
  getEquipment: ReturnType<typeof createPublicCatalog>['getPublicEquipment']
}) {
  return async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
  ): Promise<Response> {
    try {
      const tenant = await deps.resolveTenant(request)
      if (!tenant.ok) return tenant.response
      const { id } = await props.params
      if (!EQUIPMENT_ID.test(id)) return notFound()
      const equipment = await deps.getEquipment(tenant.context, id)
      if (!equipment) return notFound()
      return Response.json(equipment, {
        headers: publicCacheHeaders(
          tenant.edge,
          'public, max-age=60, stale-while-revalidate=300'
        ),
      })
    } catch (error) {
      console.error('Erro ao buscar equipamento público:', error)
      return Response.json(
        { error: 'Erro ao buscar equipamento' },
        { status: 500 }
      )
    }
  }
}
