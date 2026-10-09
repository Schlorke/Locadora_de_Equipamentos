import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import {
  publicCacheHeaders,
  type PublicRequestTenant,
} from '../modules/identity/index'

/** Adaptador do serviço; o host só liga as dependências e declara a rota. */
export function createPublicCategoriesHandler(deps: {
  resolveTenant: (_request: Request) => Promise<PublicRequestTenant>
  listCategories: (_context: TenantContext) => Promise<unknown>
}) {
  return async function GET(request: Request): Promise<Response> {
    try {
      const tenant = await deps.resolveTenant(request)
      if (!tenant.ok) return tenant.response
      return Response.json(await deps.listCategories(tenant.context), {
        headers: publicCacheHeaders(
          tenant.edge,
          'public, max-age=60, stale-while-revalidate=300'
        ),
      })
    } catch {
      return Response.json(
        { error: 'Erro ao buscar categorias' },
        { status: 500 }
      )
    }
  }
}
