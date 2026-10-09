import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import {
  publicCacheHeaders,
  type PublicRequestTenant,
} from '../modules/identity/index'

/** Transporte HTTP do catálogo público, com a projeção a cargo do módulo. */
export function createPublicEquipmentsHandler(deps: {
  resolveTenant: (_request: Request) => Promise<PublicRequestTenant>
  listEquipments: (_context: TenantContext) => Promise<unknown>
}) {
  return async function GET(request: Request): Promise<Response> {
    try {
      const tenant = await deps.resolveTenant(request)
      if (!tenant.ok) return tenant.response
      return Response.json(await deps.listEquipments(tenant.context), {
        headers: publicCacheHeaders(
          tenant.edge,
          'public, max-age=60, stale-while-revalidate=300'
        ),
      })
    } catch {
      return Response.json(
        { error: 'Erro ao buscar equipamentos' },
        { status: 500 }
      )
    }
  }
}
