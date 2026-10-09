import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { PublicRequestTenant } from '../modules/identity/index'

/** O módulo de catálogo mantém validação do termo, seleção e limite. */
export function createPublicEquipmentSearchHandler(deps: {
  resolveTenant: (_request: Request) => Promise<PublicRequestTenant>
  searchEquipments: (
    _context: TenantContext,
    _query: string | null
  ) => Promise<unknown>
}) {
  return async function GET(request: Request): Promise<Response> {
    try {
      const tenant = await deps.resolveTenant(request)
      if (!tenant.ok) return tenant.response
      const { searchParams } = new URL(request.url)
      return Response.json(
        await deps.searchEquipments(tenant.context, searchParams.get('q'))
      )
    } catch (error) {
      console.error('Erro na busca de equipamentos:', error)
      return Response.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      )
    }
  }
}
