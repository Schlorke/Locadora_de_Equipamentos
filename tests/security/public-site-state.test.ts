const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  return { prisma: database.prisma }
}
/**
 * S13 (ADR docs/architecture/adr-saas-subscription.md, B.5 "Site público", B.10 "Público", D1 e D23; ADR de hosts,
 * D10): a antiga app/api foi retirada em F; as APIs públicas de apps/services/api seguem a regra do
 * resolvedor canônico. Fiscalização on:
 * - LIVE (FULL e publicada): responde;
 * - PAUSED (RESTRICTED e publicada): catálogo, busca, disponibilidade, orçamento e contato respondem 503
 *   `SITE_PAUSED` com Retry-After, sem cache e noindex, sem tocar no banco da locadora; cartão e configurações
 *   continuam (página de pausa) e levam o modo; a área do cliente continua;
 * - OFF (não publicada, SETUP, ARCHIVED ou bloqueio administrativo): o mesmo 404 da locadora desconhecida, byte a
 *   byte, em toda API pública da vitrine.
 * Área do cliente (B.5, linha "Área do cliente final"), separada da vitrine: FULL e RESTRICTED continuam com o site em
 * qualquer modo, inclusive desligado por falta de publicação (/organizations/current, vínculo e o cartão com
 * `?scope=client-area`); SETUP, ARCHIVED e o bloqueio administrativo dão o 404 da locadora desconhecida.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_SITE } from '../helpers/public-site'

const state = vi.hoisted(() => ({
  organizations: new Map<string, Record<string, unknown>>(),
  transactions: 0,
}))
const database = vi.hoisted(() => {
  const findUnique = async ({ where }: { where: { slug?: string } }) =>
    where.slug === undefined
      ? null
      : (() => {
          const organization = state.organizations.get(where.slug)
          return organization ? { ...organization } : null
        })()
  const transaction = async (operation: unknown) => {
    state.transactions += 1
    if (typeof operation !== 'function') throw new Error('unexpected batch')
    const list = async () => []
    return operation({
      $queryRaw: async () => [],
      $executeRaw: async () => 0,
      $executeRawUnsafe: async () => 0,
      organization: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const found = [...state.organizations.entries()].find(
            ([, organization]) => organization.id === where.id
          )
          return found
            ? {
                slug: found[0],
                name: 'Locadora ' + found[0],
                city: null,
                state: null,
                status: found[1].status,
              }
            : null
        },
      },
      setting: {
        findFirst: async () => ({
          companyPhone: '(51) 3333-0000',
          whatsappNumber: '(51) 99999-0000',
          contactEmail: 'contato@pausada.test',
          companyIconUrl: null,
          // Onda 134: os Termos publicados da locadora (a página legal continua no ar na pausa).
          termsDocument: {
            version: 1,
            lastUpdated: '2 de março de 2026',
            sections: [
              {
                id: 'uso',
                title: 'Uso',
                blocks: [{ type: 'paragraph', text: 'Texto dos Termos.' }],
              },
            ],
          },
          termsPublishedAt: new Date('2026-03-02T12:00:00.000Z'),
        }),
      },
      category: { findMany: list },
      equipment: { findMany: list, findFirst: async () => null },
    })
  }
  return { prisma: { organization: { findUnique }, $transaction: transaction } }
})

vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => ({ prisma: database.prisma }),
  }))(importOriginal)
  return {
    ...originalComposition,
    getDatabaseRuntime: () => ({
      prisma: fPreparedDatabase.value!.prisma,
      ...(fPreparedDatabase.pool ? { pool: fPreparedDatabase.pool } : {}),
    }),
  }
})

vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: async () => null,
}))

vi.mock(
  '../../apps/services/api/src/host/rate-limit',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/rate-limit')
    >()),
    checkRateLimit: () => ({ allowed: true }),
  })
)

import { NextRequest } from 'next/server'

import { GET as serviceCategories } from '../../apps/services/api/src/app/api/categories/route'
import { GET as serviceEquipments } from '../../apps/services/api/src/app/api/equipments/route'
import { GET as serviceSearch } from '../../apps/services/api/src/app/api/equipamentos/search/route'
import { GET as serviceAvailability } from '../../apps/services/api/src/app/api/equipments/[id]/availability/route'
import { GET as serviceDetail } from '../../apps/services/api/src/app/api/equipments/[id]/route'
import { POST as serviceQuote } from '../../apps/services/api/src/app/api/quotes/route'
import { POST as serviceOrcamento } from '../../apps/services/api/src/app/api/orcamentos/route'
import { POST as serviceContact } from '../../apps/services/api/src/app/api/contact/route'
import { GET as serviceSettings } from '../../apps/services/api/src/app/api/settings/public/route'
import { GET as serviceLegalDocument } from '../../apps/services/api/src/app/api/settings/public/legal-documents/[kind]/route'
import { GET as serviceCard } from '../../apps/services/api/src/app/api/public/tenants/[slug]/route'
import { GET as serviceCurrent } from '../../apps/services/api/src/app/api/auth/organizations/current/route'
import { POST as serviceEnroll } from '../../apps/services/api/src/app/api/client/enroll/route'

const SECRET = 'segredo-de-borda-do-site-por-estado-0123456789'
const ROOT = 'platform.test'
const API = 'https://backend.internal'
const ORGANIZATIONS: Record<string, Record<string, unknown>> = {
  'loc-live': { id: 'tenant-live', status: 'ACTIVE', ...LIVE_SITE },
  'loc-paused': {
    id: 'tenant-paused',
    status: 'ACTIVE',
    ...LIVE_SITE,
    access: 'RESTRICTED',
  },
  'loc-unpublished': {
    id: 'tenant-unpublished',
    status: 'ACTIVE',
    ...LIVE_SITE,
    sitePublishedAt: null,
  },
  'loc-setup': {
    id: 'tenant-setup',
    status: 'ACTIVE',
    ...LIVE_SITE,
    access: 'SETUP',
  },
  'loc-archived': {
    id: 'tenant-archived',
    status: 'ACTIVE',
    ...LIVE_SITE,
    access: 'ARCHIVED',
  },
  'loc-blocked': { id: 'tenant-blocked', status: 'SUSPENDED', ...LIVE_SITE },
}
const OFF = ['loc-unpublished', 'loc-setup', 'loc-archived', 'loc-blocked']

/** Área do cliente aberta (FULL ou RESTRICTED, publicada ou não) e fechada (SETUP, ARCHIVED, bloqueio). */
const CLIENT_AREA_OPEN: Array<[string, 'LIVE' | 'PAUSED' | 'OFF']> = [
  ['loc-live', 'LIVE'],
  ['loc-paused', 'PAUSED'],
  ['loc-unpublished', 'OFF'],
]
const CLIENT_AREA_CLOSED = ['loc-setup', 'loc-archived', 'loc-blocked']

const tenantEdge = (slug: string) => ({
  'x-platform-edge-auth': SECRET,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': slug,
  'x-platform-origin': `https://${slug}.${ROOT}`,
})
const params = <T extends object>(value: T) => ({
  params: Promise.resolve(value),
})
const get = (path: string) => new NextRequest(API + path)
const post = (path: string, body: object) =>
  new NextRequest(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
const quote = {
  customerName: 'Cliente',
  customerEmail: 'cliente@example.test',
  customerPhone: '00000000000',
  items: [{ equipmentId: 'eq-1', quantity: 1, days: 1 }],
}
const contact = { name: 'Contato', email: 'c@example.test', message: 'Olá' }

type Call = (_slug: string) => Promise<Response>
type Host = {
  categories: typeof serviceCategories
  equipments: typeof serviceEquipments
  search: typeof serviceSearch
  availability: typeof serviceAvailability
  detail: typeof serviceDetail
  quote: typeof serviceQuote
  orcamento: typeof serviceOrcamento
  contact: typeof serviceContact
  settings: typeof serviceSettings
  legalDocument: typeof serviceLegalDocument
  card: typeof serviceCard
  current: typeof serviceCurrent
  enroll: typeof serviceEnroll
}
const HOSTS: Array<[string, Host]> = [
  [
    'serviço (apps/services/api)',
    {
      categories: serviceCategories,
      equipments: serviceEquipments,
      search: serviceSearch,
      availability: serviceAvailability,
      detail: serviceDetail,
      quote: serviceQuote,
      orcamento: serviceOrcamento,
      contact: serviceContact,
      settings: serviceSettings,
      legalDocument: serviceLegalDocument,
      card: serviceCard,
      current: serviceCurrent,
      enroll: serviceEnroll,
    },
  ],
]
/** Vitrine: catálogo, busca, disponibilidade, detalhe, orçamento e contato. */
const storefront = (host: Host): Array<[string, Call]> => [
  [
    'categorias',
    (s) => host.categories(get(`/api/categories?tenantSlug=${s}`)),
  ],
  [
    'equipamentos',
    (s) => host.equipments(get(`/api/equipments?tenantSlug=${s}`)),
  ],
  [
    'busca',
    (s) => host.search(get(`/api/equipamentos/search?q=be&tenantSlug=${s}`)),
  ],
  [
    'disponibilidade',
    (s) =>
      host.availability(
        get(`/api/equipments/eq-1/availability?tenantSlug=${s}`),
        params({ id: 'eq-1' })
      ),
  ],
  [
    'detalhe',
    (s) =>
      host.detail(
        get(`/api/equipments/eq-1?tenantSlug=${s}`),
        params({ id: 'eq-1' })
      ),
  ],
  [
    'orçamento',
    (s) => host.quote(post('/api/quotes', { ...quote, tenantSlug: s })),
  ],
  [
    'orçamento legado',
    (s) => host.orcamento(post('/api/orcamentos', { ...quote, tenantSlug: s })),
  ],
  [
    'contato',
    (s) => host.contact(post('/api/contact', { ...contact, tenantSlug: s })),
  ],
]
/** Identidade da locadora: a página de pausa e a área do cliente usam. */
const identity = (host: Host): Array<[string, Call]> => [
  [
    'configurações',
    (s) => host.settings(get(`/api/settings/public?tenantSlug=${s}`)),
  ],
  // Onda 134 (decisão do dono de 2026-10-06, item 4): os textos legais continuam no ar na pausa.
  [
    'documento legal',
    (s) =>
      host.legalDocument(
        get(`/api/settings/public/legal-documents/terms?tenantSlug=${s}`),
        params({ kind: 'terms' })
      ),
  ],
  [
    'cartão',
    (s) => host.card(get(`/api/public/tenants/${s}`), params({ slug: s })),
  ],
]

const currentOf = (host: Host, slug: string, query = '') =>
  host.current(
    new NextRequest(API + '/api/auth/organizations/current' + query, {
      headers: tenantEdge(slug),
    })
  )
const enrollOf = (host: Host, slug: string, body: object, query = '') =>
  host.enroll(
    new NextRequest(API + '/api/client/enroll' + query, {
      method: 'POST',
      headers: {
        ...tenantEdge(slug),
        origin: `https://${slug}.${ROOT}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  )
const clientAreaCardOf = (host: Host, slug: string) =>
  host.card(
    get(`/api/public/tenants/${slug}?scope=client-area`),
    params({ slug })
  )

async function snapshot(response: Response) {
  return {
    status: response.status,
    headers: [...response.headers.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    ),
    body: await response.text(),
  }
}

beforeEach(() => {
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
  vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
  vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
  vi.stubEnv('WEB_PUBLIC_ORIGIN', '')
  vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
  state.organizations.clear()
  for (const [slug, organization] of Object.entries(ORGANIZATIONS))
    state.organizations.set(slug, organization)
  state.transactions = 0
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe.each(HOSTS)('%s', (_host, host) => {
  describe('PAUSED: vitrine desligada com 503 SITE_PAUSED', () => {
    it.each(storefront(host))(
      '%s responde 503 com Retry-After, sem cache e noindex, sem abrir transação da locadora',
      async (_route, call) => {
        const response = await call('loc-paused')
        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({
          error: 'Este site está temporariamente indisponível.',
          code: 'SITE_PAUSED',
        })
        expect(response.headers.get('retry-after')).toBe('3600')
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(response.headers.get('x-robots-tag')).toBe('noindex')
        expect(state.transactions).toBe(0)
      }
    )

    it.each(identity(host))(
      '%s continua (contato da página de pausa)',
      async (_route, call) => {
        const response = await call('loc-paused')
        expect(response.status).toBe(200)
      }
    )

    it('documento legal em pausa: o texto da própria locadora, com no-store', async () => {
      const response = await host.legalDocument(
        get('/api/settings/public/legal-documents/terms?tenantSlug=loc-paused'),
        params({ kind: 'terms' })
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.json()).toMatchObject({
        kind: 'terms',
        publishedAt: '2026-03-02T12:00:00.000Z',
        document: { lastUpdated: '2 de março de 2026' },
      })
    })

    it('o cartão leva o modo PAUSED, não indexável e sem cache', async () => {
      const response = await host.card(
        get('/api/public/tenants/loc-paused'),
        params({ slug: 'loc-paused' })
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('x-site-mode')).toBe('PAUSED')
      expect(response.headers.get('x-site-indexable')).toBe('false')
      expect(response.headers.get('cache-control')).toBe('no-store')
    })

    it('área do cliente: /organizations/current continua no host da locadora', async () => {
      const response = await host.current(
        new NextRequest(API + '/api/auth/organizations/current', {
          headers: tenantEdge('loc-paused'),
        })
      )
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        error: 'Authentication required',
      })
    })

    it('área do cliente: o vínculo (enroll) passa da resolução da locadora', async () => {
      const response = await host.enroll(
        new NextRequest(API + '/api/client/enroll', {
          method: 'POST',
          headers: {
            ...tenantEdge('loc-paused'),
            origin: `https://loc-paused.${ROOT}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({}),
        })
      )
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Confirme o consentimento para vincular sua conta',
      })
    })
  })

  describe('OFF: o mesmo 404 da locadora desconhecida (D10)', () => {
    it.each(
      [...storefront(host), ...identity(host)].flatMap(([route, call]) =>
        OFF.map((slug) => [route, slug, call] as const)
      )
    )('%s de %s', async (_route, slug, call) => {
      const off = await snapshot(await call(slug))
      const unknown = await snapshot(await call('loc-desconhecida'))
      expect(off.status).toBe(404)
      expect(off).toEqual(unknown)
      expect(state.transactions).toBe(0)
    })
  })

  describe('área do cliente (B.5, linha "Área do cliente final"): separada da vitrine', () => {
    it.each(CLIENT_AREA_OPEN)(
      '/organizations/current de %s continua (401 sem sessão)',
      async (slug) => {
        for (const query of ['', `?tenantSlug=${slug}`]) {
          const response = await currentOf(host, slug, query)
          expect(response.status, query).toBe(401)
          expect(await response.json()).toEqual({
            error: 'Authentication required',
          })
        }
      }
    )

    it.each(CLIENT_AREA_OPEN)(
      'vínculo (enroll) de %s passa das duas resoluções da locadora, com tenantSlug no corpo ou na query',
      async (slug) => {
        for (const [body, query] of [
          [{ consent: true }, ''],
          [{ consent: true, tenantSlug: slug }, ''],
          [{ consent: true }, `?tenantSlug=${slug}`],
        ] as const) {
          const response = await enrollOf(host, slug, body, query)
          expect(response.status, JSON.stringify([body, query])).toBe(401)
          expect(await response.json()).toEqual({
            error: 'Authentication required',
          })
        }
      }
    )

    it.each(CLIENT_AREA_OPEN)(
      'cartão com ?scope=client-area de %s responde com o modo %s',
      async (slug, mode) => {
        const response = await clientAreaCardOf(host, slug)
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ slug })
        expect(response.headers.get('x-site-mode')).toBe(mode)
        expect(response.headers.get('cache-control')).toBe(
          mode === 'LIVE'
            ? 'public, max-age=60, stale-while-revalidate=300'
            : 'no-store'
        )
      }
    )

    it.each(CLIENT_AREA_CLOSED)(
      'sem área do cliente (%s): /organizations/current, vínculo e cartão com escopo dão o 404 da locadora desconhecida',
      async (slug) => {
        const calls: Array<[string, Call]> = [
          ['current', (s) => currentOf(host, s)],
          ['current com query', (s) => currentOf(host, s, `?tenantSlug=${s}`)],
          ['enroll', (s) => enrollOf(host, s, { consent: true })],
          [
            'enroll com tenantSlug',
            (s) => enrollOf(host, s, { consent: true, tenantSlug: s }),
          ],
          ['cartão com escopo', (s) => clientAreaCardOf(host, s)],
        ]
        for (const [name, call] of calls) {
          const closed = await snapshot(await call(slug))
          const unknown = await snapshot(await call('loc-desconhecida'))
          expect(closed.status, name).toBe(404)
          expect(closed, name).toEqual(unknown)
        }
        expect(state.transactions).toBe(0)
      }
    )

    it('sem o escopo, o cartão de locadora não publicada continua o 404 da vitrine', async () => {
      const off = await snapshot(
        await host.card(
          get('/api/public/tenants/loc-unpublished'),
          params({ slug: 'loc-unpublished' })
        )
      )
      const unknown = await snapshot(
        await host.card(
          get('/api/public/tenants/loc-desconhecida'),
          params({ slug: 'loc-desconhecida' })
        )
      )
      expect(off.status).toBe(404)
      expect(off).toEqual(unknown)
    })

    it('fiscalização off (D23): SETUP e ARCHIVED têm área do cliente; o bloqueio administrativo não', async () => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
      for (const slug of ['loc-setup', 'loc-archived']) {
        expect((await currentOf(host, slug)).status, slug).toBe(401)
        expect((await clientAreaCardOf(host, slug)).status, slug).toBe(200)
      }
      expect((await currentOf(host, 'loc-blocked')).status).toBe(404)
    })
  })

  describe('LIVE: vitrine no ar', () => {
    it('o cartão leva o modo LIVE e indexável', async () => {
      const response = await host.card(
        get('/api/public/tenants/loc-live'),
        params({ slug: 'loc-live' })
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('x-site-mode')).toBe('LIVE')
      expect(response.headers.get('x-site-indexable')).toBe('true')
    })

    it('noindex até a 1ª fatura paga: LIVE sem siteIndexable', async () => {
      state.organizations.set('loc-live', {
        ...ORGANIZATIONS['loc-live'],
        siteIndexable: false,
      })
      const response = await host.card(
        get('/api/public/tenants/loc-live'),
        params({ slug: 'loc-live' })
      )
      expect(response.headers.get('x-site-mode')).toBe('LIVE')
      expect(response.headers.get('x-site-indexable')).toBe('false')
    })

    it.each(storefront(host).slice(0, 2))(
      '%s responde 200',
      async (_route, call) => {
        expect((await call('loc-live')).status).toBe(200)
      }
    )
  })

  describe('fiscalização off (D23): acesso tratado como FULL', () => {
    it.each(storefront(host).slice(0, 2))(
      '%s de locadora RESTRICTED publicada responde 200 (nunca pausa)',
      async (_route, call) => {
        vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
        expect((await call('loc-paused')).status).toBe(200)
      }
    )

    it.each(storefront(host).slice(0, 2))(
      '%s de locadora não publicada continua 404 (publicar não depende da fiscalização)',
      async (_route, call) => {
        vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
        expect((await call('loc-unpublished')).status).toBe(404)
      }
    )
  })
})

// As duas comparações byte a byte entre a antiga raiz e o serviço foram
// executadas antes da aposentadoria no bloco F. A matriz ativa acima mantém
// LIVE/PAUSED/OFF, área do cliente, cabeçalhos e ausência de efeitos no serviço.
