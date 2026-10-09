// S13: o resolvedor público decide LIVE, PAUSED e OFF pela regra única do domínio (decidirModoDoSite), para os dois
// hosts HTTP. ADR docs/architecture/adr-saas-subscription.md (B.5, B.10, D1, D23) e adr-tenant-hosts.md (D10).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPublicTenantResolver,
  publicSiteHeaders,
  publicTenantNotFound,
  type PublicOrganization,
  type PublicTenantResolverOptions,
} from './public-tenant'

const SECRET = 'segredo-de-borda-do-resolvedor-publico-0123456789'
const PUBLISHED = new Date('2026-09-01T12:00:00.000Z')
const live = (
  parcial: Partial<PublicOrganization> = {}
): PublicOrganization => ({
  id: 'tenant-alfa',
  status: 'ACTIVE',
  access: 'FULL',
  sitePublishedAt: PUBLISHED,
  siteIndexable: true,
  ...parcial,
})

function resolver(
  organization: unknown,
  enforcement: string | undefined,
  observe?: PublicTenantResolverOptions['observe']
) {
  const lookup = vi.fn(async () => organization as PublicOrganization | null)
  return {
    lookup,
    ...createPublicTenantResolver(lookup, {
      enforcement: () => enforcement,
      observe,
    }),
  }
}
const explicit = (path = '/api/categories?tenantSlug=alfa') =>
  new Request('https://api.internal' + path)
const tenantHost = (path = '/api/auth/organizations/current') =>
  new Request('https://api.internal' + path, {
    headers: {
      'x-platform-edge-auth': SECRET,
      'x-platform-host-kind': 'tenant',
      'x-platform-tenant-slug': 'alfa',
      'x-platform-origin': 'https://alfa.platform.test',
    },
  })
async function snapshot(response: Response) {
  return {
    status: response.status,
    body: await response.text(),
    headers: [...response.headers.entries()],
  }
}

beforeEach(() => {
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'platform.test')
  vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
  vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
  vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('vitrine (storefront, padrão) com fiscalização on', () => {
  it('LIVE responde com o modo e a indexação', async () => {
    const result = await resolver(live(), 'on').resolvePublicRequestTenant(
      explicit()
    )
    expect(result).toMatchObject({
      ok: true,
      context: { tenantId: 'tenant-alfa' },
      slug: 'alfa',
      site: { mode: 'LIVE', indexable: true },
    })
  })

  it('LIVE sem siteIndexable continua no ar e não indexável', async () => {
    const result = await resolver(
      live({ siteIndexable: false }),
      'on'
    ).resolvePublicRequestTenant(explicit())
    expect(result).toMatchObject({
      ok: true,
      site: { mode: 'LIVE', indexable: false },
    })
  })

  it('PAUSED (RESTRICTED): 503 SITE_PAUSED com Retry-After, sem cache e noindex', async () => {
    const result = await resolver(
      live({ access: 'RESTRICTED' }),
      'on'
    ).resolvePublicRequestTenant(explicit())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('SITE_PAUSED')
    expect(result.response.status).toBe(503)
    expect(await result.response.json()).toEqual({
      error: 'Este site está temporariamente indisponível.',
      code: 'SITE_PAUSED',
    })
    expect(result.response.headers.get('retry-after')).toBe('3600')
    expect(result.response.headers.get('cache-control')).toBe('no-store')
    expect(result.response.headers.get('x-robots-tag')).toBe('noindex')
  })

  it.each([
    ['não publicada', live({ sitePublishedAt: null })],
    ['SETUP', live({ access: 'SETUP' })],
    ['ARCHIVED', live({ access: 'ARCHIVED' })],
    ['acesso fora do contrato', live({ access: 'UNKNOWN' })],
    [
      'fatos ausentes (consulta antiga)',
      { id: 'tenant-alfa', status: 'ACTIVE' },
    ],
    ['bloqueio administrativo', live({ status: 'SUSPENDED' })],
  ])(
    'OFF (%s): o mesmo 404 de locadora inexistente, byte a byte',
    async (_caso, organization) => {
      const off = await resolver(organization, 'on').resolvePublicRequestTenant(
        explicit()
      )
      const unknown = await resolver(null, 'on').resolvePublicRequestTenant(
        explicit()
      )
      expect(off.ok || unknown.ok).toBe(false)
      if (off.ok || unknown.ok) return
      expect(off.code).toBe('TENANT_NOT_FOUND')
      const offSnapshot = await snapshot(off.response)
      expect(offSnapshot).toEqual(await snapshot(unknown.response))
      expect(offSnapshot).toEqual(await snapshot(publicTenantNotFound()))
    }
  )
})

describe('identidade (cartão e configurações) com fiscalização on', () => {
  it('PAUSED responde com o modo, para a página de pausa', async () => {
    const result = await resolver(
      live({ access: 'RESTRICTED' }),
      'on'
    ).resolvePublicRequestTenant(explicit(), { surface: 'identity' })
    expect(result).toMatchObject({
      ok: true,
      site: { mode: 'PAUSED', indexable: false },
    })
  })

  it.each([live({ sitePublishedAt: null }), live({ access: 'ARCHIVED' })])(
    'OFF continua 404 do D10',
    async (organization) => {
      const result = await resolver(
        organization,
        'on'
      ).resolvePublicRequestTenant(explicit(), { surface: 'identity' })
      expect(result).toMatchObject({ ok: false, code: 'TENANT_NOT_FOUND' })
    }
  )
})

describe('área do cliente (client-area): linha "Área do cliente final" da B.5, separada da vitrine', () => {
  it.each([
    ['FULL publicada', live(), 'LIVE'],
    ['RESTRICTED publicada', live({ access: 'RESTRICTED' }), 'PAUSED'],
    ['FULL não publicada', live({ sitePublishedAt: null }), 'OFF'],
    [
      'RESTRICTED não publicada',
      live({ access: 'RESTRICTED', sitePublishedAt: null }),
      'OFF',
    ],
  ] as const)(
    '%s responde com o site em qualquer modo (%s)',
    async (_caso, organization, mode) => {
      const result = await resolver(
        organization,
        'on'
      ).resolvePublicRequestTenant(explicit(), { surface: 'client-area' })
      expect(result).toMatchObject({
        ok: true,
        context: { tenantId: 'tenant-alfa' },
        site: { mode },
      })
    }
  )

  it.each([
    ['SETUP', live({ access: 'SETUP' })],
    ['ARCHIVED', live({ access: 'ARCHIVED' })],
    ['acesso fora do contrato', live({ access: 'UNKNOWN' })],
    [
      'fatos ausentes (consulta antiga)',
      { id: 'tenant-alfa', status: 'ACTIVE' },
    ],
    ['bloqueio administrativo', live({ status: 'SUSPENDED' })],
  ])(
    'sem área do cliente (%s): o mesmo 404 de locadora inexistente, byte a byte',
    async (_caso, organization) => {
      const closed = await resolver(
        organization,
        'on'
      ).resolvePublicRequestTenant(explicit(), { surface: 'client-area' })
      const unknown = await resolver(null, 'on').resolvePublicRequestTenant(
        explicit(),
        { surface: 'client-area' }
      )
      expect(closed.ok || unknown.ok).toBe(false)
      if (closed.ok || unknown.ok) return
      expect(closed.code).toBe('TENANT_NOT_FOUND')
      expect(await snapshot(closed.response)).toEqual(
        await snapshot(unknown.response)
      )
    }
  )

  it.each(['off', 'shadow'])(
    '%s trata o acesso como FULL: SETUP e ARCHIVED têm área do cliente',
    async (enforcement) => {
      for (const access of ['SETUP', 'ARCHIVED']) {
        const result = await resolver(
          live({ access, sitePublishedAt: null }),
          enforcement,
          () => {}
        ).resolvePublicRequestTenant(explicit(), { surface: 'client-area' })
        expect(result, access).toMatchObject({ ok: true })
      }
    }
  )

  it('bloqueio administrativo continua 404 com a fiscalização off', async () => {
    const result = await resolver(
      live({ status: 'SUSPENDED' }),
      'off'
    ).resolvePublicRequestTenant(explicit(), { surface: 'client-area' })
    expect(result).toMatchObject({ ok: false, code: 'TENANT_NOT_FOUND' })
  })

  it('/organizations/current continua com o site desligado por falta de publicação', async () => {
    const result = await resolver(
      live({ sitePublishedAt: null }),
      'on'
    ).resolveCurrentOrganizationTenant(tenantHost())
    expect(result).toMatchObject({ ok: true, site: { mode: 'OFF' } })
    const agreed = await resolver(
      live({ sitePublishedAt: null }),
      'on'
    ).resolveCurrentOrganizationTenant(
      tenantHost('/api/auth/organizations/current?tenantSlug=alfa')
    )
    expect(agreed.ok).toBe(true)
  })

  it('/organizations/current de locadora ARCHIVED (on): 404 do D10, com ou sem tenantSlug na query', async () => {
    for (const path of [
      '/api/auth/organizations/current',
      '/api/auth/organizations/current?tenantSlug=alfa',
    ]) {
      const result = await resolver(
        live({ access: 'ARCHIVED' }),
        'on'
      ).resolveCurrentOrganizationTenant(tenantHost(path))
      expect(result, path).toMatchObject({
        ok: false,
        code: 'TENANT_NOT_FOUND',
      })
    }
  })

  it('o principal privado continua identificando a locadora do host ARCHIVED (o S8 responde TENANT_ARCHIVED)', async () => {
    expect(
      await resolver(live({ access: 'ARCHIVED' }), 'on').resolvePublicTenant(
        'alfa'
      )
    ).toEqual({
      tenantId: 'tenant-alfa',
      slug: 'alfa',
      site: { mode: 'OFF', indexable: false },
    })
  })

  it('/organizations/current continua no host da locadora com o site em pausa', async () => {
    const result = await resolver(
      live({ access: 'RESTRICTED' }),
      'on'
    ).resolveCurrentOrganizationTenant(tenantHost())
    expect(result).toMatchObject({
      ok: true,
      slug: 'alfa',
      site: { mode: 'PAUSED' },
    })
    const agreed = await resolver(
      live({ access: 'RESTRICTED' }),
      'on'
    ).resolveCurrentOrganizationTenant(
      tenantHost('/api/auth/organizations/current?tenantSlug=alfa')
    )
    expect(agreed.ok).toBe(true)
  })

  it('o principal privado identifica a locadora do host pausada (resolvePublicTenant)', async () => {
    expect(
      await resolver(live({ access: 'RESTRICTED' }), 'on').resolvePublicTenant(
        'alfa'
      )
    ).toEqual({
      tenantId: 'tenant-alfa',
      slug: 'alfa',
      site: { mode: 'PAUSED', indexable: false },
    })
  })
})

describe('fiscalização (D23)', () => {
  it.each(['off', undefined])(
    'off (%s) trata o acesso como FULL: RESTRICTED publicado fica LIVE',
    async (enforcement) => {
      const result = await resolver(
        live({ access: 'RESTRICTED' }),
        enforcement
      ).resolvePublicRequestTenant(explicit())
      expect(result).toMatchObject({ ok: true, site: { mode: 'LIVE' } })
    }
  )

  it('sem injeção, lê PLATFORM_SUBSCRIPTION_ENFORCEMENT do processo', async () => {
    vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
    const lookup = vi.fn(async () => live({ access: 'RESTRICTED' }))
    const result =
      await createPublicTenantResolver(lookup).resolvePublicRequestTenant(
        explicit()
      )
    expect(result).toMatchObject({ ok: false, code: 'SITE_PAUSED' })
  })

  it('off não dispensa a publicação: não publicada é 404', async () => {
    const result = await resolver(
      live({ sitePublishedAt: null }),
      'off'
    ).resolvePublicRequestTenant(explicit())
    expect(result).toMatchObject({ ok: false, code: 'TENANT_NOT_FOUND' })
  })

  it('shadow aplica off e registra o que on faria', async () => {
    const observe = vi.fn()
    const result = await resolver(
      live({ access: 'RESTRICTED' }),
      'shadow',
      observe
    ).resolvePublicRequestTenant(explicit())
    expect(result).toMatchObject({ ok: true, site: { mode: 'LIVE' } })
    expect(observe).toHaveBeenCalledExactlyOnceWith({
      tenantId: 'tenant-alfa',
      slug: 'alfa',
      applied: 'LIVE',
      computed: 'PAUSED',
      clientArea: { applied: true, computed: true },
    })
  })

  it('shadow registra a área do cliente que on fecharia, mesmo com o site igual', async () => {
    const observe = vi.fn()
    const result = await resolver(
      live({ access: 'ARCHIVED', sitePublishedAt: null }),
      'shadow',
      observe
    ).resolvePublicRequestTenant(explicit(), { surface: 'client-area' })
    expect(result).toMatchObject({ ok: true, site: { mode: 'OFF' } })
    expect(observe).toHaveBeenCalledExactlyOnceWith({
      tenantId: 'tenant-alfa',
      slug: 'alfa',
      applied: 'OFF',
      computed: 'OFF',
      clientArea: { applied: true, computed: false },
    })
  })

  it('shadow não registra quando on decidiria igual', async () => {
    const observe = vi.fn()
    await resolver(live(), 'shadow', observe).resolvePublicRequestTenant(
      explicit()
    )
    expect(observe).not.toHaveBeenCalled()
  })

  it('falha do registro de shadow não muda a resposta', async () => {
    const result = await resolver(
      live({ access: 'ARCHIVED' }),
      'shadow',
      () => {
        throw new Error('fixture-shadow-sink')
      }
    ).resolvePublicRequestTenant(explicit())
    expect(result).toMatchObject({ ok: true, site: { mode: 'LIVE' } })
  })

  it('shadow sem registro injetado usa o console', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await resolver(
      live({ access: 'SETUP' }),
      'shadow'
    ).resolvePublicRequestTenant(explicit())
    expect(warn).toHaveBeenCalledWith('[site-shadow]', {
      tenantId: 'tenant-alfa',
      slug: 'alfa',
      applied: 'LIVE',
      computed: 'OFF',
      clientArea: { applied: true, computed: false },
    })
  })

  it.each(['ligado', ''])(
    'valor inválido (%j) aplica on (falha fechada)',
    async (enforcement) => {
      const result = await resolver(
        live({ access: 'RESTRICTED' }),
        enforcement
      ).resolvePublicRequestTenant(explicit())
      expect(result).toMatchObject({ ok: false, code: 'SITE_PAUSED' })
    }
  )
})

describe('cabeçalhos e consulta', () => {
  it('publicSiteHeaders: modo e indexação; pausa sem cache', () => {
    expect(publicSiteHeaders({ mode: 'LIVE', indexable: true })).toEqual({
      'x-site-mode': 'LIVE',
      'x-site-indexable': 'true',
    })
    expect(publicSiteHeaders({ mode: 'PAUSED', indexable: false })).toEqual({
      'Cache-Control': 'no-store',
      'x-site-mode': 'PAUSED',
      'x-site-indexable': 'false',
    })
    // OFF só chega ao cartão no escopo da área do cliente.
    expect(publicSiteHeaders({ mode: 'OFF', indexable: false })).toEqual({
      'Cache-Control': 'no-store',
      'x-site-mode': 'OFF',
      'x-site-indexable': 'false',
    })
  })

  it.each([
    ['/api/public/tenants/alfa?scope=client-area', true],
    ['/api/public/tenants/alfa', false],
    ['/api/public/tenants/alfa?scope=storefront', false],
    ['/api/public/tenants/alfa?scope=CLIENT-AREA', false],
  ] as const)(
    'cartão (surface card) de locadora não publicada: %s responde? %s',
    async (path, open) => {
      const result = await resolver(
        live({ sitePublishedAt: null }),
        'on'
      ).resolvePublicRequestTenant(explicit(path), {
        pathSlug: 'alfa',
        surface: 'card',
      })
      expect(result).toMatchObject(
        open
          ? { ok: true, site: { mode: 'OFF' } }
          : { ok: false, code: 'TENANT_NOT_FOUND' }
      )
    }
  )

  it('cartão (surface card) em pausa responde nos dois escopos, nunca 503', async () => {
    for (const path of [
      '/api/public/tenants/alfa',
      '/api/public/tenants/alfa?scope=client-area',
    ]) {
      const result = await resolver(
        live({ access: 'RESTRICTED' }),
        'on'
      ).resolvePublicRequestTenant(explicit(path), {
        pathSlug: 'alfa',
        surface: 'card',
      })
      expect(result, path).toMatchObject({ ok: true, site: { mode: 'PAUSED' } })
    }
  })

  it('cartão (surface card) com escopo da área do cliente de locadora ARCHIVED (on): 404', async () => {
    const result = await resolver(
      live({ access: 'ARCHIVED' }),
      'on'
    ).resolvePublicRequestTenant(
      explicit('/api/public/tenants/alfa?scope=client-area'),
      { pathSlug: 'alfa', surface: 'card' }
    )
    expect(result).toMatchObject({ ok: false, code: 'TENANT_NOT_FOUND' })
  })

  it('slug inválido não consulta o banco', async () => {
    const { lookup, resolvePublicRequestTenant } = resolver(live(), 'on')
    const result = await resolvePublicRequestTenant(
      explicit('/api/categories?tenantSlug=Inv%C3%A1lido')
    )
    expect(result).toMatchObject({ ok: false, code: 'TENANT_NOT_FOUND' })
    expect(lookup).not.toHaveBeenCalled()
  })
})
