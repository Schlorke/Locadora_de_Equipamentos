import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type {
  PublicRequestTenant,
  PublicRequestTenantOptions,
} from '../modules/identity/index'

/** Preserva os códigos e a normalização próprios desta rota legada. */
export function createPublicSettingsHandler(deps: {
  resolveTenant: (
    _request: Request,
    _options: PublicRequestTenantOptions
  ) => Promise<PublicRequestTenant>
  getSettings: (_context: TenantContext) => Promise<unknown>
}) {
  return async function GET(request: Request): Promise<Response> {
    try {
      // Contato da locadora: a página de pausa e a área do cliente continuam usando (S13).
      const tenant = await deps.resolveTenant(request, {
        trim: true,
        requiredCode: true,
        surface: 'identity',
      })
      if (!tenant.ok) return tenant.response
      const settings = await deps.getSettings(tenant.context)
      if (!settings)
        return Response.json(
          {
            error: 'Configurações públicas indisponíveis nesta locadora',
            code: 'SETTINGS_NOT_CONFIGURED',
          },
          { status: 409 }
        )
      return Response.json(settings)
    } catch (error) {
      console.error('Erro ao buscar configurações públicas:', error)
      return Response.json(
        { error: 'Não foi possível carregar as configurações públicas' },
        { status: 500 }
      )
    }
  }
}
