/**
 * T7 (ADR docs/architecture/adr-tenant-hosts.md, desenho 4.13): num host de
 * locadora, a locadora vem somente da borda validada. `tenantSlug` na query,
 * no corpo ou no caminho, `x-tenant-id` e o cookie de seleção de outra
 * locadora respondem 400 antes de qualquer escrita. Borda forjada sem o
 * segredo é ignorada, e sem borda o contrato explícito atual continua.
 *
 * Sem banco, o Prisma é um dublê que só responde à busca de organização e
 * registra qualquer outra tentativa de transação. Com TEST_DATABASE_URL
 * descartável, o bloco final conta as linhas de `quotes` e `outbox_events`
 * das duas locadoras antes e depois, com controles positivos que provam que a
 * mesma rota grava quando a locadora concorda.
 */
import { randomUUID } from 'node:crypto'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { LIVE_SITE } from '../helpers/public-site'

const state = vi.hoisted(() => ({
  userId: null as string | null,
  lookups: [] as string[],
  transactions: 0,
  organizations: new Map<string, Record<string, unknown>>(),
}))

const fixtureDatabase = vi.hoisted(() => ({ prisma: undefined as unknown }))
vi.mock('@/lib/prisma', async () => {
  if (process.env.TEST_DATABASE_URL) {
    const { requireTestDatabase } = await import('../helpers/test-database')
    const { Pool } = await import('pg')
    const { PrismaClient } = await import('@prisma/client')
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const pool = new Pool({
      connectionString: requireTestDatabase(process.env),
      max: 4,
    })
    return {
      prisma: (fixtureDatabase.prisma = new PrismaClient({
        adapter: new PrismaPg(pool),
      })),
      testPool: pool,
    }
  }
  return {
    prisma: (fixtureDatabase.prisma = {
      organization: {
        findUnique: async ({ where }: { where: { slug: string } }) => {
          state.lookups.push(where.slug)
          const organization = state.organizations.get(where.slug)
          return organization ? { ...organization } : null
        },
      },
      $transaction: async () => {
        state.transactions += 1
        throw new Error(
          'database writes are not available without TEST_DATABASE_URL'
        )
      },
    }),
  }
})
vi.mock('@/lib/application-session', () => ({
  getServerSession: async () =>
    state.userId ? { user: { id: state.userId } } : null,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimit: () => ({ allowed: true }),
}))
vi.mock('@/lib/resend', () => ({
  default: () => ({
    emails: { send: async () => ({ data: { id: 'test' }, error: null }) },
  }),
}))

import { NextRequest } from 'next/server'
import { isTrustedMutationOrigin } from '@/lib/security/mutation-origin'
import { readPublicTenantCard } from '@gb-locacoes/backend/directory'
import type { PrismaClient } from '@prisma/client'
// As fixtures (tests/helpers/fixtures.ts) leem o banco pelo runtime do backend (onda 135, E4): o mesmo cliente que a
// fábrica de `@/lib/prisma` acima cria, guardado no momento da criação (sem import cruzado entre os dois dublês).
import { prisma } from '@/lib/prisma'
import { publicCacheHeaders, withTenantTransaction } from '@/lib/tenant'
import { readPlatformEdgeContext } from '../../packages/backend/src/modules/identity/platform-edge'
import {
  cleanupTestData,
  createCategory,
  createEquipment,
  createTestTracker,
  ensureTestTenant,
} from '../helpers/fixtures'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  // As fixtures e as rotas do serviço leem o mesmo cliente (real ou simulado) que a fábrica de `@/lib/prisma` cria.
  getDatabaseRuntime: () => ({ prisma: fixtureDatabase.prisma }),
  ...(await (async () => {
    const F = await (() => ({
      default: () => ({
        emails: { send: async () => ({ data: { id: 'test' }, error: null }) },
      }),
    }))()
    return { createResendClient: () => F.default() }
  })()),
}))
vi.mock(
  '../../apps/services/api/src/host/rate-limit',
  async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
    checkRateLimit: () => ({ allowed: true }),
  })
)
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({
    getServerSession: async () =>
      state.userId ? { user: { id: state.userId } } : null,
  }))()),
}))
import * as legacyRoute0 from '@/app/api/quotes/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/quotes/route'
import * as legacyRoute1 from '@/app/api/contact/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/contact/route'
import * as legacyRoute2 from '@/app/api/orcamentos/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/orcamentos/route'
import * as legacyRoute3 from '@/app/api/categories/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/categories/route'
import * as legacyRoute4 from '@/app/api/equipments/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/equipments/route'
import * as legacyRoute5 from '@/app/api/equipamentos/search/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/equipamentos/search/route'
import * as legacyRoute6 from '@/app/api/equipments/[id]/availability/route'
import * as serviceRoute6 from '../../apps/services/api/src/app/api/equipments/[id]/availability/route'
import * as legacyRoute7 from '@/app/api/settings/public/route'
import * as serviceRoute7 from '../../apps/services/api/src/app/api/settings/public/route'
import * as legacyRoute8 from '@/app/api/equipments/[id]/route'
import * as serviceRoute8 from '../../apps/services/api/src/app/api/equipments/[id]/route'
import * as legacyRoute9 from '@/app/api/public/tenants/[slug]/route'
import * as serviceRoute9 from '../../apps/services/api/src/app/api/public/tenants/[slug]/route'
import * as legacyRoute10 from '@/app/api/auth/organizations/current/route'
import * as serviceRoute10 from '../../apps/services/api/src/app/api/auth/organizations/current/route'

const HOSTS = [
  [
    'legacy root',
    {
      listQuotes: legacyRoute0.GET,
      postQuote: legacyRoute0.POST,
      postContact: legacyRoute1.POST,
      postOrcamento: legacyRoute2.POST,
      categories: legacyRoute3.GET,
      equipments: legacyRoute4.GET,
      search: legacyRoute5.GET,
      availability: legacyRoute6.GET,
      settings: legacyRoute7.GET,
      equipmentDetail: legacyRoute8.GET,
      tenantCard: legacyRoute9.GET,
      currentOrganization: legacyRoute10.GET,
    },
  ],
  [
    'service',
    {
      listQuotes: serviceRoute0.GET,
      postQuote: serviceRoute0.POST,
      postContact: serviceRoute1.POST,
      postOrcamento: serviceRoute2.POST,
      categories: serviceRoute3.GET,
      equipments: serviceRoute4.GET,
      search: serviceRoute5.GET,
      availability: serviceRoute6.GET,
      settings: serviceRoute7.GET,
      equipmentDetail: serviceRoute8.GET,
      tenantCard: serviceRoute9.GET,
      currentOrganization: serviceRoute10.GET,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      listQuotes,
      postQuote,
      postContact,
      postOrcamento,
      categories,
      equipments,
      search,
      availability,
      settings,
      equipmentDetail,
      tenantCard,
      currentOrganization,
    }
  ) => {
    const SECRET = 'edge-secret-tenant-request-0123456789'
    const ROOT = 'plataforma.test'
    const API = 'https://backend.internal'
    const originOf = (slug: string) => `https://${slug}.${ROOT}`
    const tenantEdge = (slug: string, secret = SECRET) => ({
      'x-platform-edge-auth': secret,
      'x-platform-host-kind': 'tenant',
      'x-platform-tenant-slug': slug,
      'x-platform-origin': originOf(slug),
      'x-platform-client-ip': '203.0.113.9',
    })
    const appEdge = {
      'x-platform-edge-auth': SECRET,
      'x-platform-host-kind': 'app',
      'x-platform-origin': `https://app.${ROOT}`,
    }
    const get = (path: string, headers: Record<string, string> = {}) =>
      new NextRequest(API + path, { headers })
    const post = (
      path: string,
      body: unknown,
      headers: Record<string, string> = {}
    ) =>
      new NextRequest(API + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      })
    const params = <T extends object>(value: T) => ({
      params: Promise.resolve(value),
    })
    const conflict = {
      error: 'Seleção de locadora conflitante',
      code: 'TENANT_CONFLICT',
    }
    const quoteBody = (equipmentId: string, tenantSlug?: string) => ({
      ...(tenantSlug === undefined ? {} : { tenantSlug }),
      customerName: 'Cliente T7',
      customerEmail: 't7@example.test',
      customerPhone: '00000000000',
      deliveryType: 'PICKUP',
      items: [
        {
          equipmentId,
          quantity: 1,
          days: 1,
          startDate: '2030-02-10',
          endDate: '2030-02-10',
        },
      ],
    })
    const contactBody = (tenantSlug?: string) => ({
      ...(tenantSlug === undefined ? {} : { tenantSlug }),
      name: 'Contato T7',
      email: 't7@example.test',
      message: 'Mensagem de teste',
    })

    async function expectConflict(response: Response) {
      expect(response.status).toBe(400)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.json()).toEqual(conflict)
    }

    beforeEach(() => {
      vi.stubEnv('PLATFORM_ENV', 'staging')
      vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
      vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
      vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
      vi.stubEnv('VERCEL_ENV', '')
      vi.stubEnv('WEB_PUBLIC_ORIGIN', '')
      state.userId = null
      state.lookups.length = 0
      state.transactions = 0
      state.organizations.clear()
      state.organizations.set('alfa', {
        id: 'tenant-alfa',
        status: 'ACTIVE',
        ...LIVE_SITE,
      })
      state.organizations.set('bravo', {
        id: 'tenant-bravo',
        status: 'ACTIVE',
        ...LIVE_SITE,
      })
    })
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })

    describe.skipIf(Boolean(process.env.TEST_DATABASE_URL))(
      'tenant host conflicts are rejected before any database access',
      () => {
        it.each([
          [
            'categories',
            () =>
              categories(
                get('/api/categories?tenantSlug=bravo', tenantEdge('alfa'))
              ),
          ],
          [
            'equipments',
            () =>
              equipments(
                get('/api/equipments?tenantSlug=bravo', tenantEdge('alfa'))
              ),
          ],
          [
            'search',
            () =>
              search(
                get(
                  '/api/equipamentos/search?tenantSlug=bravo&q=be',
                  tenantEdge('alfa')
                )
              ),
          ],
          [
            'availability',
            () =>
              availability(
                get(
                  '/api/equipments/eq-1/availability?tenantSlug=bravo',
                  tenantEdge('alfa')
                ),
                params({ id: 'eq-1' })
              ),
          ],
          [
            'settings',
            () =>
              settings(
                get('/api/settings/public?tenantSlug=bravo', tenantEdge('alfa'))
              ),
          ],
          [
            'equipment detail',
            () =>
              equipmentDetail(
                get(
                  '/api/equipments/eq-1?tenantSlug=bravo',
                  tenantEdge('alfa')
                ),
                params({ id: 'eq-1' })
              ),
          ],
          [
            'tenant card (path slug)',
            () =>
              tenantCard(
                get('/api/public/tenants/bravo', tenantEdge('alfa')),
                params({ slug: 'bravo' })
              ),
          ],
          [
            'duplicated query value',
            () =>
              categories(
                get(
                  '/api/categories?tenantSlug=alfa&tenantSlug=bravo',
                  tenantEdge('alfa')
                )
              ),
          ],
        ])(
          '%s: another tenantSlug on host alfa is a 400 conflict',
          async (_name, call) => {
            await expectConflict(await call())
            expect(state.lookups).toEqual([])
            expect(state.transactions).toBe(0)
          }
        )

        it.each([
          ['quotes', postQuote],
          ['orcamentos', postOrcamento],
        ] as const)(
          '%s: body or query of another tenant on host alfa writes nothing',
          async (_name, handler) => {
            const path = _name === 'quotes' ? '/api/quotes' : '/api/orcamentos'
            const headers = { ...tenantEdge('alfa'), origin: originOf('alfa') }
            await expectConflict(
              await handler(post(path, quoteBody('eq-1', 'bravo'), headers))
            )
            await expectConflict(
              await handler(
                post(
                  path + '?tenantSlug=bravo',
                  quoteBody('eq-1', 'alfa'),
                  headers
                )
              )
            )
            await expectConflict(
              await handler(
                post(
                  path + '?tenantSlug=alfa',
                  quoteBody('eq-1', 'bravo'),
                  headers
                )
              )
            )
            await expectConflict(
              await handler(
                post(path + '?tenantSlug=bravo', quoteBody('eq-1'), headers)
              )
            )
            expect(state.lookups).toEqual([])
            expect(state.transactions).toBe(0)
          }
        )

        it('contact: body or query of another tenant on host alfa writes nothing', async () => {
          const headers = { ...tenantEdge('alfa'), origin: originOf('alfa') }
          await expectConflict(
            await postContact(
              post('/api/contact', contactBody('bravo'), headers)
            )
          )
          await expectConflict(
            await postContact(
              post(
                '/api/contact?tenantSlug=bravo',
                contactBody('alfa'),
                headers
              )
            )
          )
          expect(state.lookups).toEqual([])
          expect(state.transactions).toBe(0)
        })

        it('without an edge, query and body naming different tenants also conflict', async () => {
          await expectConflict(
            await postQuote(
              post('/api/quotes?tenantSlug=alfa', quoteBody('eq-1', 'bravo'))
            )
          )
          expect(state.lookups).toEqual([])
        })

        it('a mutation from another tenant origin on host alfa is refused before writing', async () => {
          for (const headers of [
            { origin: originOf('bravo') },
            { origin: `https://app.${ROOT}` },
            { origin: originOf('alfa'), 'sec-fetch-site': 'same-site' },
          ]) {
            for (const [handler, body] of [
              [postQuote, quoteBody('eq-1', 'alfa')],
              [postContact, contactBody()],
            ] as const) {
              const response = await handler(
                post('/api/x', body, { ...tenantEdge('alfa'), ...headers })
              )
              expect(response.status).toBe(403)
              expect(response.headers.get('cache-control')).toBe('no-store')
            }
          }
          expect(state.transactions).toBe(0)
        })

        // Achados 1 e 24: o backend de produção configurado como a ADR manda (sem
        // WEB_API_ORIGIN, variável só do web) mantém a borda e as regras de T7.
        it('production backend without WEB_API_ORIGIN still enforces the tenant host', async () => {
          vi.stubEnv('PLATFORM_ENV', 'production')
          vi.stubEnv('WEB_API_ORIGIN', '')
          const host = { ...tenantEdge('alfa'), origin: originOf('alfa') }
          await expectConflict(
            await categories(get('/api/categories?tenantSlug=bravo', host))
          )
          await expectConflict(
            await postQuote(
              post('/api/quotes', quoteBody('eq-1', 'bravo'), host)
            )
          )
          await expectConflict(
            await postContact(post('/api/contact', contactBody('bravo'), host))
          )
          // A origem cruzada é recusada: /api/quotes pela guarda de mesma origem,
          // antes de consultar a locadora; /api/contact só depois de validar a
          // locadora do host (a origem esperada vem da borda). Uma consulta, só da
          // locadora do host, e nenhuma escrita.
          for (const [handler, body, lookups] of [
            [postQuote, quoteBody('eq-1', 'alfa'), []],
            [postContact, contactBody(), ['alfa']],
          ] as const) {
            state.lookups.length = 0
            expect(
              (
                await handler(
                  post('/api/x', body, {
                    ...tenantEdge('alfa'),
                    origin: originOf('bravo'),
                  })
                )
              ).status
            ).toBe(403)
            expect(state.lookups).toEqual(lookups)
          }
          const trusted = (origin: string) =>
            isTrustedMutationOrigin(
              new Request(API + '/api/x', {
                method: 'POST',
                headers: { ...tenantEdge('alfa'), origin },
              })
            )
          expect(trusted(originOf('alfa'))).toBe(true)
          expect(trusted(originOf('bravo'))).toBe(false)
          expect(state.transactions).toBe(0)
        })

        it('private routes: x-tenant-id or selection cookie of another tenant on host alfa is a 400', async () => {
          state.userId = 'user-1'
          for (const headers of [
            { 'x-tenant-id': 'tenant-bravo' },
            { cookie: 'selected-tenant-id=tenant-bravo' },
            {
              'x-tenant-id': 'tenant-alfa',
              cookie: 'selected-tenant-id=tenant-bravo',
            },
          ]) {
            const response = await listQuotes(
              get('/api/quotes', { ...tenantEdge('alfa'), ...headers })
            )
            expect(response.status).toBe(400)
            expect(await response.json()).toEqual({
              error: 'Conflicting tenant selection',
            })
          }
          expect(state.lookups).toEqual(['alfa', 'alfa', 'alfa'])
          expect(state.transactions).toBe(0)
        })

        it('a forged edge without the secret is ignored: no implicit tenant and no conflict', async () => {
          // `bravo` é uma locadora válida, fora dos reservados e ativa no dublê:
          // só o segredo decide se a borda vale (achado 3 da revisão).
          const forged = tenantEdge(
            'bravo',
            'forged-secret-0123456789abcdefghijkl'
          )
          const genuine = tenantEdge('bravo')
          expect(
            readPlatformEdgeContext(get('/api/categories', genuine))
          ).toMatchObject({ hostKind: 'tenant', tenantSlug: 'bravo' })
          expect(
            readPlatformEdgeContext(get('/api/categories', forged))
          ).toBeNull()

          const required = await categories(get('/api/categories', forged))
          expect(required.status).toBe(409)
          expect(await required.json()).toEqual({
            error: 'Selecione uma locadora',
          })
          expect(state.lookups).toEqual([])
          // Controle positivo: a mesma query com o segredo certo conflita com o host.
          await expectConflict(
            await categories(get('/api/categories?tenantSlug=alfa', genuine))
          )
          state.organizations.delete('alfa')
          const explicit = await categories(
            get('/api/categories?tenantSlug=alfa', forged)
          )
          expect(explicit.status).toBe(404)
          expect(state.lookups).toEqual(['alfa'])

          state.userId = 'user-1'
          const privateRoute = await currentOrganization(
            get('/api/auth/organizations/current', forged)
          )
          expect(privateRoute.status).toBe(409)
          expect(await privateRoute.json()).toEqual({
            error: 'Disponível somente no endereço da locadora',
            code: 'TENANT_REQUIRED',
          })
          expect(state.transactions).toBe(0)
          // Controle positivo: com o segredo certo a rota passa do host e busca o
          // vínculo (o dublê sem banco recusa a transação: 503).
          const genuineRoute = await currentOrganization(
            get('/api/auth/organizations/current', genuine)
          )
          expect(genuineRoute.status).toBe(503)
          expect(state.lookups).toEqual(['alfa', 'bravo'])
          expect(state.transactions).toBe(1)
        })

        it('organizations/current outside a tenant host: 409 TENANT_REQUIRED with code, private and Vary, before any lookup', async () => {
          state.userId = 'user-1'
          const apexEdge = {
            'x-platform-edge-auth': SECRET,
            'x-platform-host-kind': 'apex',
            'x-platform-origin': `https://${ROOT}`,
          }
          const forged = tenantEdge(
            'alfa',
            'forged-secret-0123456789abcdefghijkl'
          )
          expect(
            readPlatformEdgeContext(
              get('/api/auth/organizations/current', apexEdge)
            )
          ).toMatchObject({ hostKind: 'apex' })
          for (const headers of [{}, appEdge, apexEdge, forged])
            for (const query of [
              '',
              '?tenantSlug=alfa',
              '?tenantSlug=desconhecida',
              '?tenantSlug=api',
              '?tenantSlug=alfa&tenantSlug=bravo',
            ]) {
              const response = await currentOrganization(
                get('/api/auth/organizations/current' + query, headers)
              )
              expect(response.status).toBe(409)
              expect(response.headers.get('cache-control')).toBe(
                'private, no-store'
              )
              expect(response.headers.get('vary')).toBe('Cookie, Host')
              expect(await response.json()).toEqual({
                error: 'Disponível somente no endereço da locadora',
                code: 'TENANT_REQUIRED',
              })
            }
          expect(state.lookups).toEqual([])
          expect(state.transactions).toBe(0)
        })

        it('organizations/current only answers on a tenant host', async () => {
          state.userId = 'user-1'
          const noHost = await currentOrganization(
            get('/api/auth/organizations/current')
          )
          expect(noHost.status).toBe(409)
          const app = await currentOrganization(
            get('/api/auth/organizations/current?tenantSlug=alfa', appEdge)
          )
          expect(app.status).toBe(409)
          expect(await app.json()).toMatchObject({ code: 'TENANT_REQUIRED' })
          expect(app.headers.get('cache-control')).toBe('private, no-store')
          await expectConflict(
            await currentOrganization(
              get(
                '/api/auth/organizations/current?tenantSlug=bravo',
                tenantEdge('alfa')
              )
            )
          )
          expect(state.transactions).toBe(0)
        })
      }
    )

    describe('public cache policy', () => {
      const fallback = 'public, max-age=60, stale-while-revalidate=300'
      const edgeOf = (headers: Record<string, string>) =>
        readPlatformEdgeContext(new Request(API + '/api/x', { headers }))

      it('tenant hosts cache only in the browser, never in a shared cache', () => {
        const edge = edgeOf(tenantEdge('alfa'))
        expect(edge).toMatchObject({ hostKind: 'tenant' })
        const headers = publicCacheHeaders(edge, fallback)
        expect(headers).toEqual({
          'Cache-Control': 'public, max-age=60',
          Vary: 'Host',
        })
        expect(JSON.stringify(headers)).not.toMatch(
          /s-maxage|CDN-Cache-Control/i
        )
      })

      it('app host, forged edge and no edge keep the route policy', () => {
        for (const edge of [
          edgeOf(appEdge),
          edgeOf(tenantEdge('alfa', 'forged-secret-0123456789abcdefghijkl')),
          null,
        ])
          expect(publicCacheHeaders(edge, fallback)).toEqual({
            'Cache-Control': fallback,
          })
      })
    })

    describe('isTrustedMutationOrigin', () => {
      it('expects the edge origin on a platform host, ignoring WEB_PUBLIC_ORIGIN', () => {
        const on = (origin: string, configured?: string) =>
          isTrustedMutationOrigin(
            new Request(API + '/api/x', {
              method: 'POST',
              headers: { ...tenantEdge('alfa'), origin },
            }),
            configured
          )
        expect(on(originOf('alfa'))).toBe(true)
        expect(on(originOf('alfa'), 'https://legado.example.test')).toBe(true)
        expect(on(originOf('bravo'))).toBe(false)
        expect(
          on('https://legado.example.test', 'https://legado.example.test')
        ).toBe(false)
      })

      it('keeps the configured public origin when there is no valid edge', () => {
        const on = (origin: string, configured?: string, secret = SECRET) =>
          isTrustedMutationOrigin(
            new Request(API + '/api/x', {
              method: 'POST',
              headers: { ...tenantEdge('alfa', secret), origin },
            }),
            configured
          )
        const forged = 'forged-secret-0123456789abcdefghijkl'
        expect(
          on(
            'https://legado.example.test',
            'https://legado.example.test',
            forged
          )
        ).toBe(true)
        expect(
          on(originOf('alfa'), 'https://legado.example.test', forged)
        ).toBe(false)
        expect(on(API, undefined, forged)).toBe(true)
        expect(on(originOf('alfa'), undefined, forged)).toBe(false)
      })
    })

    describe('public tenant card', () => {
      function fakeClient(options: {
        organization?: Record<string, unknown> | null
        logo?: string
      }) {
        const steps: string[] = []
        const tx = {
          $queryRaw: async (sql: TemplateStringsArray, tenantId: string) => {
            steps.push(sql.join('?') + ' ' + tenantId)
            return []
          },
          organization: {
            findUnique: async (query: { select: Record<string, boolean> }) => {
              steps.push(
                'organization ' + Object.keys(query.select).sort().join(',')
              )
              return options.organization === undefined
                ? {
                    slug: 'alfa',
                    name: '  Locadora Alfa  ',
                    city: ' Curitiba ',
                    state: 'pr',
                    status: 'ACTIVE',
                  }
                : options.organization
            },
          },
          setting: {
            findFirst: async (query: {
              where: unknown
              select: Record<string, boolean>
            }) => {
              steps.push('setting ' + JSON.stringify(query))
              return {
                companyIconUrl:
                  options.logo ?? 'https://cdn.example.test/alfa.png',
              }
            },
          },
        }
        const client = {
          $transaction: async (
            operation: (_value: typeof tx) => Promise<unknown>
          ) => operation(tx),
        } as unknown as PrismaClient
        return { client, steps }
      }
      const subject = { tenantId: 'tenant-alfa', slug: 'alfa' }

      it('returns only slug, name, city, state and an https logo read inside the tenant transaction', async () => {
        const { client, steps } = fakeClient({})
        expect(await readPublicTenantCard(client, subject)).toStrictEqual({
          slug: 'alfa',
          name: 'Locadora Alfa',
          city: 'Curitiba',
          state: 'PR',
          logoUrl: 'https://cdn.example.test/alfa.png',
        })
        expect(steps).toEqual([
          "SELECT set_config('app.tenant_id', ?, true) tenant-alfa",
          'organization city,name,slug,state,status',
          'setting ' +
            JSON.stringify({
              where: { tenantId: 'tenant-alfa' },
              select: { companyIconUrl: true },
            }),
        ])
      })

      it.each([
        'http://cdn.example.test/alfa.png',
        '/uploads/alfa.png',
        'javascript:alert(1)',
        'https://user:pass@cdn.example.test/alfa.png',
        '',
      ])('drops a logo that is not a plain https URL (%s)', async (logo) => {
        const { client } = fakeClient({ logo })
        expect(await readPublicTenantCard(client, subject)).toMatchObject({
          logoUrl: null,
        })
      })

      it.each([
        [
          'a suspended organization',
          {
            slug: 'alfa',
            name: 'Alfa',
            city: null,
            state: null,
            status: 'SUSPENDED',
          },
        ],
        [
          'a renamed slug',
          {
            slug: 'outra',
            name: 'Alfa',
            city: null,
            state: null,
            status: 'ACTIVE',
          },
        ],
        [
          'a blank name',
          {
            slug: 'alfa',
            name: '   ',
            city: null,
            state: null,
            status: 'ACTIVE',
          },
        ],
        ['a missing organization', null],
      ])('returns null for %s', async (_name, organization) => {
        const { client } = fakeClient({ organization })
        expect(await readPublicTenantCard(client, subject)).toBeNull()
      })
    })

    describe.skipIf(!process.env.TEST_DATABASE_URL)(
      'tenant host conflicts write no rows (disposable database)',
      () => {
        const trackerA = createTestTracker()
        const trackerB = createTestTracker()
        const slugA = trackerA.tenantSlug
        const slugB = trackerB.tenantSlug
        const userId = 't7-user-' + randomUUID()
        const outsiderId = 't7-outsider-' + randomUUID()
        let equipmentA = ''
        let equipmentB = ''
        const hostA = () => ({ ...tenantEdge(slugA), origin: originOf(slugA) })

        const counts = async () => {
          const count = (tenantId: string) =>
            withTenantTransaction({ tenantId }, async (tx) => ({
              quotes: await tx.quote.count({ where: { tenantId } }),
              outbox: await tx.outboxEvent.count({ where: { tenantId } }),
            }))
          return {
            a: await count(trackerA.tenantId),
            b: await count(trackerB.tenantId),
          }
        }

        beforeAll(async () => {
          await ensureTestTenant(trackerA)
          await ensureTestTenant(trackerB)
          equipmentA = (
            await createEquipment(trackerA, (await createCategory(trackerA)).id)
          ).id
          equipmentB = (
            await createEquipment(trackerB, (await createCategory(trackerB)).id)
          ).id
          await prisma.user.createMany({
            data: [
              { id: userId, email: userId + '@example.test', role: 'CLIENT' },
              {
                id: outsiderId,
                email: outsiderId + '@example.test',
                role: 'CLIENT',
              },
            ],
          })
          trackerA.users.add(userId)
          trackerA.users.add(outsiderId)
          await prisma.membership.createMany({
            data: [
              { tenantId: trackerA.tenantId, userId, role: 'CLIENT' },
              { tenantId: trackerB.tenantId, userId, role: 'ADMIN' },
              {
                tenantId: trackerB.tenantId,
                userId: outsiderId,
                role: 'CLIENT',
              },
            ],
          })
        })
        afterAll(async () => {
          await cleanupTestData(trackerB)
          await cleanupTestData(trackerA)
        })

        it('conflicting quotes, orcamentos and contacts on host A leave both tenants untouched', async () => {
          const before = await counts()
          const attempts: Array<() => Promise<Response>> = [
            () =>
              postQuote(
                post('/api/quotes', quoteBody(equipmentA, slugB), hostA())
              ),
            () =>
              postQuote(
                post('/api/quotes', quoteBody(equipmentB, slugB), hostA())
              ),
            () =>
              postQuote(
                post(
                  `/api/quotes?tenantSlug=${slugB}`,
                  quoteBody(equipmentA, slugA),
                  hostA()
                )
              ),
            () =>
              postQuote(
                post(
                  `/api/quotes?tenantSlug=${slugA}`,
                  quoteBody(equipmentA, slugB),
                  hostA()
                )
              ),
            () =>
              postOrcamento(
                post('/api/orcamentos', quoteBody(equipmentB, slugB), hostA())
              ),
            () =>
              postContact(post('/api/contact', contactBody(slugB), hostA())),
            () =>
              postContact(
                post(`/api/contact?tenantSlug=${slugB}`, contactBody(), hostA())
              ),
          ]
          for (const attempt of attempts) await expectConflict(await attempt())
          for (const origin of [originOf(slugB), `https://app.${ROOT}`]) {
            expect(
              (
                await postQuote(
                  post('/api/quotes', quoteBody(equipmentA), {
                    ...hostA(),
                    origin,
                  })
                )
              ).status
            ).toBe(403)
            expect(
              (
                await postContact(
                  post('/api/contact', contactBody(), { ...hostA(), origin })
                )
              ).status
            ).toBe(403)
          }
          expect(await counts()).toEqual(before)
        })

        it('the same routes write to A when the request agrees with the host (positive control)', async () => {
          state.userId = userId
          const before = await counts()
          expect(
            (
              await postQuote(
                post('/api/quotes', quoteBody(equipmentA, slugA), hostA())
              )
            ).status
          ).toBe(201)
          expect(
            (
              await postQuote(
                post('/api/quotes', quoteBody(equipmentA), hostA())
              )
            ).status
          ).toBe(201)
          expect(
            (await postContact(post('/api/contact', contactBody(), hostA())))
              .status
          ).toBe(202)
          const after = await counts()
          expect(after.a.quotes).toBe(before.a.quotes + 3)
          expect(after.b).toEqual(before.b)
        })

        it('an equipment of B cannot be quoted through host A', async () => {
          const before = await counts()
          const response = await postQuote(
            post('/api/quotes', quoteBody(equipmentB), hostA())
          )
          expect(response.status).toBeGreaterThanOrEqual(400)
          expect(response.status).toBeLessThan(500)
          expect(await counts()).toEqual(before)
        })

        it('a forged edge naming B is ignored and the explicit A contract still applies', async () => {
          const before = await counts()
          const forged = tenantEdge(
            slugB,
            'forged-secret-0123456789abcdefghijkl'
          )
          // Borda ignorada: a origem esperada é a da própria requisição
          // (WEB_PUBLIC_ORIGIN vazio), e o tenantSlug explícito de A decide.
          expect(
            (
              await postQuote(
                post('/api/quotes', quoteBody(equipmentA, slugA), {
                  ...forged,
                  origin: API,
                })
              )
            ).status
          ).toBe(201)
          const after = await counts()
          expect(after.a.quotes).toBe(before.a.quotes + 1)
          expect(after.b).toEqual(before.b)
          // A borda forjada não torna a origem de B confiável: a guarda de mesma
          // origem recusa antes de gravar (sem borda válida, a rota não confere a
          // origem de novo depois de resolver a locadora).
          const crossed = await postQuote(
            post('/api/quotes', quoteBody(equipmentA, slugA), {
              ...forged,
              origin: originOf(slugB),
            })
          )
          expect(crossed.status).toBe(403)
          expect(crossed.headers.get('cache-control')).toBe('no-store')
          expect(await counts()).toEqual(after)
        })

        it('private quotes: selection of B on host A is a 400; the host alone selects A', async () => {
          state.userId = userId
          for (const headers of [
            { 'x-tenant-id': trackerB.tenantId },
            { cookie: `selected-tenant-id=${trackerB.tenantId}` },
          ]) {
            const response = await listQuotes(
              get('/api/quotes', { ...tenantEdge(slugA), ...headers })
            )
            expect(response.status).toBe(400)
          }
          const hostOnly = await listQuotes(
            get('/api/quotes', tenantEdge(slugA))
          )
          expect(hostOnly.status).toBe(200)
          expect(hostOnly.headers.get('cache-control')).toBe(
            'private, no-store'
          )
          expect(hostOnly.headers.get('vary')).toBe('Cookie, x-tenant-id')
          const quotes = (await hostOnly.json()) as Array<{ id: string }>
          expect(quotes.length).toBeGreaterThan(0)
          const owners = await prisma.quote.findMany({
            where: { id: { in: quotes.map((quote) => quote.id) } },
            select: { tenantId: true },
          })
          expect(new Set(owners.map((owner) => owner.tenantId))).toEqual(
            new Set([trackerA.tenantId])
          )
          const agreeing = await listQuotes(
            get('/api/quotes', {
              ...tenantEdge(slugA),
              'x-tenant-id': trackerA.tenantId,
            })
          )
          expect(agreeing.status).toBe(200)
        })

        it('organizations/current returns only the membership of the host tenant', async () => {
          state.userId = userId
          const response = await currentOrganization(
            get('/api/auth/organizations/current', tenantEdge(slugA))
          )
          expect(response.status).toBe(200)
          expect(response.headers.get('cache-control')).toBe(
            'private, no-store'
          )
          const text = await response.text()
          expect(JSON.parse(text)).toEqual({
            membership: {
              membershipId: expect.any(String),
              role: 'CLIENT',
              tenant: {
                id: trackerA.tenantId,
                slug: slugA,
                name: 'Test locadora',
                status: 'ACTIVE',
              },
            },
          })
          expect(text).not.toContain(trackerB.tenantId)
          expect(text).not.toContain(slugB)
          expect(text).not.toContain('ADMIN')

          state.userId = outsiderId
          const outsider = await currentOrganization(
            get('/api/auth/organizations/current', tenantEdge(slugA))
          )
          expect(outsider.status).toBe(404)
          const outsiderText = await outsider.text()
          expect(JSON.parse(outsiderText)).toEqual({
            error: 'Sem vínculo com esta locadora',
            code: 'NO_MEMBERSHIP',
          })
          expect(outsiderText).not.toContain(trackerB.tenantId)

          state.userId = null
          expect(
            (
              await currentOrganization(
                get('/api/auth/organizations/current', tenantEdge(slugA))
              )
            ).status
          ).toBe(401)

          state.userId = userId
          await prisma.membership.update({
            where: { tenantId_userId: { tenantId: trackerA.tenantId, userId } },
            data: { status: 'SUSPENDED' },
          })
          try {
            expect(
              (
                await currentOrganization(
                  get('/api/auth/organizations/current', tenantEdge(slugA))
                )
              ).status
            ).toBe(403)
          } finally {
            await prisma.membership.update({
              where: {
                tenantId_userId: { tenantId: trackerA.tenantId, userId },
              },
              data: { status: 'ACTIVE' },
            })
          }
        })

        it('the public card exposes no document, phone, e-mail or postal code', async () => {
          await prisma.organization.update({
            where: { id: trackerA.tenantId },
            data: {
              city: 'Curitiba',
              state: 'PR',
              document: '11222333000181',
              postalCode: '80000000',
            },
          })
          await prisma.setting.create({
            data: {
              tenantId: trackerA.tenantId,
              companyIconUrl: 'https://cdn.example.test/a.png',
              companyPhone: '4133334444',
              contactEmail: 'contato-a@example.test',
              companyAddress: 'Rua A, 1',
            },
          })
          const response = await tenantCard(
            get(`/api/public/tenants/${slugA}`, appEdge),
            params({ slug: slugA })
          )
          expect(response.status).toBe(200)
          expect(response.headers.get('cache-control')).toBe(
            'public, max-age=60, stale-while-revalidate=300'
          )
          const text = await response.text()
          expect(JSON.parse(text)).toStrictEqual({
            slug: slugA,
            name: 'Test locadora',
            city: 'Curitiba',
            state: 'PR',
            logoUrl: 'https://cdn.example.test/a.png',
          })
          for (const secret of [
            '11222333000181',
            '80000000',
            '4133334444',
            'contato-a@example.test',
            'Rua A',
          ])
            expect(text).not.toContain(secret)
          await expectConflict(
            await tenantCard(
              get(`/api/public/tenants/${slugB}`, tenantEdge(slugA)),
              params({ slug: slugB })
            )
          )
        })

        it('public detail and card never cross tenants', async () => {
          const crossed = await equipmentDetail(
            get(`/api/equipments/${equipmentB}`, tenantEdge(slugA)),
            params({ id: equipmentB })
          )
          expect(crossed.status).toBe(404)
          const explicit = await equipmentDetail(
            get(`/api/equipments/${equipmentB}?tenantSlug=${slugA}`),
            params({ id: equipmentB })
          )
          expect(explicit.status).toBe(404)
          const own = await equipmentDetail(
            get(`/api/equipments/${equipmentA}`, tenantEdge(slugA)),
            params({ id: equipmentA })
          )
          expect(own.status).toBe(200)
          expect(own.headers.get('cache-control')).toBe('public, max-age=60')
          expect(own.headers.get('vary')).toBe('Host')
          expect(await own.json()).toMatchObject({
            id: equipmentA,
            pricePerDay: 150,
          })
        })
      }
    )
  }
)
