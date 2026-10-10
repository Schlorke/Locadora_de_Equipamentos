import { isTenantSlug } from '@gb-locacoes/contracts/platform'
import {
  CLIENT_AREA_CARD_SCOPE,
  OrganizationAccessSchema,
  PUBLIC_TENANT_CARD_SCOPE_PARAM,
  SITE_INDEXABLE_HEADER,
  SITE_MODE_HEADER,
  SITE_PAUSED_CODE,
  SITE_PAUSED_HEADERS,
  SITE_PAUSED_MESSAGE,
  SubscriptionEnforcementSchema,
} from '@gb-locacoes/contracts/subscription'
import {
  decidirAreaDoCliente,
  decidirModoDoSite,
  type FiscalizacaoDaAssinatura,
  type ModoDoSite,
} from '@gb-locacoes/domain/assinatura'
import {
  readPlatformEdgeContext,
  type PlatformEdgeContext,
} from './platform-edge'

/** Modo do site público já com a fiscalização (S13; regra em `decidirModoDoSite`). */
export type PublicSiteState = { mode: ModoDoSite; indexable: boolean }
export type PublicTenant = {
  tenantId: string
  slug: string
  site: PublicSiteState
}
/**
 * O que a rota pública atende (S13):
 * - `storefront` (padrão): vitrine. LIVE responde; PAUSED, 503 `SITE_PAUSED`; OFF, o 404 do D10;
 * - `identity`: cartão e configurações públicas (nome, logo, contato), que a página de pausa e a área do cliente
 *   usam. LIVE e PAUSED respondem; OFF, o 404 do D10;
 * - `client-area`: área do cliente final, separada da vitrine (linha "Área do cliente final" da matriz B.5, regra
 *   `decidirAreaDoCliente`): FULL e RESTRICTED respondem com o site em qualquer modo, inclusive desligado por falta
 *   de publicação; SETUP e ARCHIVED (fiscalização `on`) e o bloqueio administrativo, o 404 do D10.
 */
export type PublicTenantSurface = 'storefront' | 'identity' | 'client-area'
type PublicTenantFailureCode =
  | 'TENANT_CONFLICT'
  | 'TENANT_REQUIRED'
  | 'TENANT_NOT_FOUND'
  | typeof SITE_PAUSED_CODE
export type PublicRequestTenant =
  | {
      ok: true
      context: { tenantId: string }
      slug: string
      edge: PlatformEdgeContext | null
      site: PublicSiteState
    }
  | { ok: false; code: PublicTenantFailureCode; response: Response }
export type PublicRequestTenantOptions = {
  bodySlug?: unknown
  pathSlug?: string
  trim?: boolean
  requiredCode?: boolean
  /**
   * `card`: cartão público (`GET /api/public/tenants/{slug}`). Atende como `identity`; com `?scope=client-area`, como
   * `client-area` (o layout da locadora no host web, pai da vitrine e da área do cliente).
   */
  surface?: PublicTenantSurface | 'card'
}
/** Fatos de `Organization` que decidem a resolução pública e o modo do site. */
export type PublicOrganization = {
  id: string
  status: string
  access: string
  sitePublishedAt: Date | null
  siteIndexable: boolean
}
export type PublicTenantResolverOptions = {
  /** `PLATFORM_SUBSCRIPTION_ENFORCEMENT`; os testes injetam o modo. Valor inválido aplica `on` (falha fechada). */
  enforcement?: () => string | undefined
  /** Registro de `shadow`: só quando `on` mudaria o modo do site ou a área do cliente aplicados. */
  observe?: (_entry: {
    tenantId: string
    slug: string
    applied: ModoDoSite
    computed: ModoDoSite
    clientArea: { applied: boolean; computed: boolean }
  }) => void
}

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export function publicTenantNotFound(): Response {
  return Response.json(
    { error: 'Locadora não encontrada' },
    { status: 404, headers: NO_STORE }
  )
}

/** 503 das APIs da vitrine em pausa: corpo e cabeçalhos do contrato `SITE_PAUSED`. */
export function publicSitePaused(): Response {
  return Response.json(
    { error: SITE_PAUSED_MESSAGE, code: SITE_PAUSED_CODE },
    { status: 503, headers: SITE_PAUSED_HEADERS }
  )
}

export function publicCacheHeaders(
  edge: PlatformEdgeContext | null,
  fallback: string
): Record<string, string> {
  return edge?.hostKind === 'tenant'
    ? { 'Cache-Control': 'public, max-age=60', Vary: 'Host' }
    : { 'Cache-Control': fallback }
}

/**
 * Modo do site no cartão público. Fora do ar (em pausa, ou desligado no escopo da área do cliente), a resposta não
 * entra em cache.
 */
export function publicSiteHeaders(
  site: PublicSiteState
): Record<string, string> {
  return {
    ...(site.mode === 'LIVE' ? {} : NO_STORE),
    [SITE_MODE_HEADER]: site.mode,
    [SITE_INDEXABLE_HEADER]: String(site.indexable),
  }
}

/** Superfície do cartão público: `?scope=client-area` pede o escopo da área do cliente; sem ele, a identidade. */
function cardSurface(
  request: Request
): Extract<PublicTenantSurface, 'identity' | 'client-area'> {
  return new URL(request.url).searchParams.get(
    PUBLIC_TENANT_CARD_SCOPE_PARAM
  ) === CLIENT_AREA_CARD_SCOPE
    ? 'client-area'
    : 'identity'
}

function readEnforcement(
  options: PublicTenantResolverOptions
): FiscalizacaoDaAssinatura {
  const setting = SubscriptionEnforcementSchema.safeParse(
    options.enforcement?.() ??
      process.env.PLATFORM_SUBSCRIPTION_ENFORCEMENT ??
      'off'
  )
  return setting.success ? setting.data : 'on'
}

/** A composição injeta a consulta global de organização; não há sessão nem Prisma singleton aqui. */
export function createPublicTenantResolver(
  findOrganization: (_slug: string) => Promise<PublicOrganization | null>,
  options: PublicTenantResolverOptions = {}
) {
  /**
   * Organização ACTIVE com o modo do site e a área do cliente já com a fiscalização; `null` para slug inválido,
   * inexistente ou com bloqueio administrativo.
   */
  async function decide(
    slug: string
  ): Promise<{ tenant: PublicTenant; clientArea: boolean } | null> {
    if (!isTenantSlug(slug)) return null
    const organization = await findOrganization(slug)
    if (organization?.status !== 'ACTIVE') return null
    const enforcement = readEnforcement(options)
    const access = OrganizationAccessSchema.safeParse(organization.access)
    // Acesso fora do contrato não abre o site nem a área do cliente quando a fiscalização vale.
    const acesso = access.success ? access.data : 'ARCHIVED'
    const site = decidirModoDoSite(
      {
        bloqueioAdministrativo: false,
        acesso,
        publicadoEm: organization.sitePublishedAt ?? null,
        indexavel: organization.siteIndexable === true,
      },
      enforcement
    )
    const clientArea = decidirAreaDoCliente(
      { bloqueioAdministrativo: false, acesso },
      enforcement
    )
    if (
      enforcement === 'shadow' &&
      (site.calculado !== site.modo ||
        clientArea.calculado !== clientArea.disponivel)
    ) {
      try {
        ;(options.observe ?? ((entry) => console.warn('[site-shadow]', entry)))(
          {
            tenantId: organization.id,
            slug,
            applied: site.modo,
            computed: site.calculado,
            clientArea: {
              applied: clientArea.disponivel,
              computed: clientArea.calculado,
            },
          }
        )
      } catch {
        /* O diagnóstico de shadow nunca muda a resposta. */
      }
    }
    return {
      tenant: {
        tenantId: organization.id,
        slug,
        site: { mode: site.modo, indexable: site.indexavel },
      },
      clientArea: clientArea.disponivel,
    }
  }

  /** Organização ACTIVE com o modo do site; `null` para slug inválido, inexistente ou com bloqueio administrativo. */
  async function resolvePublicTenant(
    slug: string
  ): Promise<PublicTenant | null> {
    return (await decide(slug))?.tenant ?? null
  }

  async function resolvePublicRequestTenant(
    request: Request,
    options: PublicRequestTenantOptions = {}
  ): Promise<PublicRequestTenant> {
    const explicit = (value: unknown): string | null => {
      if (typeof value !== 'string') return null
      const slug = options.trim ? value.trim() : value
      return slug.trim() ? slug : null
    }
    const edge = readPlatformEdgeContext(request)
    const values = [
      ...new URL(request.url).searchParams.getAll('tenantSlug').map(explicit),
      explicit(options.bodySlug),
      explicit(options.pathSlug),
      edge?.hostKind === 'tenant' ? edge.tenantSlug : null,
    ].filter((value): value is string => value !== null)
    const distinct = new Set(values)
    if (distinct.size > 1)
      return {
        ok: false,
        code: 'TENANT_CONFLICT',
        response: Response.json(
          { error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' },
          { status: 400, headers: NO_STORE }
        ),
      }
    const [slug] = distinct
    if (slug === undefined)
      return {
        ok: false,
        code: 'TENANT_REQUIRED',
        response: Response.json(
          options.requiredCode
            ? { error: 'Selecione uma locadora', code: 'TENANT_REQUIRED' }
            : { error: 'Selecione uma locadora' },
          { status: 409, headers: NO_STORE }
        ),
      }
    const decision = await decide(slug)
    const surface =
      options.surface === 'card'
        ? cardSurface(request)
        : (options.surface ?? 'storefront')
    // Vitrine desligada, ou sem área do cliente: o mesmo 404 de locadora desconhecida (D10), byte a byte.
    if (
      !decision ||
      (surface === 'client-area'
        ? !decision.clientArea
        : decision.tenant.site.mode === 'OFF')
    )
      return {
        ok: false,
        code: 'TENANT_NOT_FOUND',
        response: publicTenantNotFound(),
      }
    const { tenant } = decision
    if (surface === 'storefront' && tenant.site.mode === 'PAUSED')
      return { ok: false, code: SITE_PAUSED_CODE, response: publicSitePaused() }
    return {
      ok: true,
      context: { tenantId: tenant.tenantId },
      slug,
      edge,
      site: tenant.site,
    }
  }
  /** Host-only context for /organizations/current, before session or membership. */
  async function resolveCurrentOrganizationTenant(
    request: Request
  ): Promise<PublicRequestTenant> {
    const required = (): PublicRequestTenant => ({
      ok: false,
      code: 'TENANT_REQUIRED',
      response: Response.json(
        {
          error: 'Disponível somente no endereço da locadora',
          code: 'TENANT_REQUIRED',
        },
        {
          status: 409,
          headers: {
            'Cache-Control': 'private, no-store',
            Vary: 'Cookie, Host',
          },
        }
      ),
    })
    // Query cannot turn the app host, apex host, or an untrusted edge into a tenant host.
    const url = new URL(request.url)
    const hostOnly = new Request(url.origin + url.pathname, {
      headers: request.headers,
    })
    // Área do cliente (B.5): continua com o site em pausa ou desligado por falta de publicação.
    const tenant = await resolvePublicRequestTenant(hostOnly, {
      surface: 'client-area',
    })
    if (!tenant.ok)
      return tenant.code === 'TENANT_REQUIRED' ? required() : tenant
    if (tenant.edge?.hostKind !== 'tenant') return required()
    // Preserve the second lookup and failure precedence of the legacy adapter.
    if (url.searchParams.has('tenantSlug')) {
      const agreed = await resolvePublicRequestTenant(request, {
        surface: 'client-area',
      })
      if (!agreed.ok) return agreed
    }
    return tenant
  }
  return {
    resolvePublicTenant,
    resolvePublicRequestTenant,
    resolveCurrentOrganizationTenant,
  }
}
