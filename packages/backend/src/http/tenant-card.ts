import type { readPublicTenantCard } from '../modules/directory/index'
import {
  publicCacheHeaders,
  publicSiteHeaders,
  publicTenantNotFound,
  type createPublicTenantResolver,
} from '../modules/identity/index'

export function createPublicTenantCardHandler(deps: {
  resolveTenant: ReturnType<
    typeof createPublicTenantResolver
  >['resolvePublicRequestTenant']
  readCard: (
    _subject: Parameters<typeof readPublicTenantCard>[1]
  ) => ReturnType<typeof readPublicTenantCard>
}) {
  return async function GET(
    request: Request,
    props: { params: Promise<{ slug: string }> }
  ): Promise<Response> {
    try {
      const { slug } = await props.params
      // Identidade da locadora: continua com o site em pausa e leva o modo nos cabeçalhos (S13). Com
      // `?scope=client-area`, responde enquanto existe a área do cliente (B.5), inclusive com o site desligado.
      const tenant = await deps.resolveTenant(request, {
        pathSlug: slug,
        surface: 'card',
      })
      if (!tenant.ok) return tenant.response
      const card = await deps.readCard({
        tenantId: tenant.context.tenantId,
        slug: tenant.slug,
      })
      if (!card) return publicTenantNotFound()
      return Response.json(card, {
        headers: {
          ...publicCacheHeaders(
            tenant.edge,
            'public, max-age=60, stale-while-revalidate=300'
          ),
          ...publicSiteHeaders(tenant.site),
        },
      })
    } catch (error) {
      console.error('Erro ao montar cartão público da locadora:', error)
      return Response.json(
        { error: 'Erro ao buscar locadora' },
        { status: 500 }
      )
    }
  }
}
