const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  return {
    prisma: {
      organization: {
        findUnique: async ({ where }: { where: { slug: string } }) => {
          state.lookups.push(where.slug)
          return where.slug === 'suspensa'
            ? { id: 'tenant-suspensa', status: 'SUSPENDED' }
            : null
        },
      },
      $transaction: async () => {
        state.transactions += 1
        throw new Error('no tenant data may be read for an unknown tenant')
      },
    },
  }
}
/**
 * T8 (ADR docs/architecture/adr-tenant-hosts.md, D10): locadora com slug
 * inválido, reservado, inexistente ou suspensa recebe o mesmo 404 em todas as
 * APIs públicas, pelo host de locadora ou pelo tenantSlug explícito: status,
 * corpo (byte a byte) e cabeçalhos idênticos. Slug inválido ou reservado nem
 * chega a consultar o banco.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  lookups: [] as string[],
  transactions: 0,
  userId: 'user-1' as string | null,
}))

import { NextRequest } from 'next/server'
import { publicTenantNotFound } from '@gb-locacoes/backend/identity'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => ({
      prisma: {
        organization: {
          findUnique: async ({ where }: { where: { slug: string } }) => {
            state.lookups.push(where.slug)
            return where.slug === 'suspensa'
              ? { id: 'tenant-suspensa', status: 'SUSPENDED' }
              : null
          },
        },
        $transaction: async () => {
          state.transactions += 1
          throw new Error('no tenant data may be read for an unknown tenant')
        },
      },
    }),
  }))(importOriginal)
  return {
    ...originalComposition,
    getDatabaseRuntime: () => ({
      prisma: fPreparedDatabase.value!.prisma,
      ...(fPreparedDatabase.pool ? { pool: fPreparedDatabase.pool } : {}),
    }),
  }
})
vi.mock(
  '../../apps/services/api/src/host/rate-limit',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/rate-limit')
    >()),
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

import * as serviceRoute0 from '../../apps/services/api/src/app/api/quotes/route'

import * as serviceRoute1 from '../../apps/services/api/src/app/api/contact/route'

import * as serviceRoute2 from '../../apps/services/api/src/app/api/orcamentos/route'

import * as serviceRoute3 from '../../apps/services/api/src/app/api/categories/route'

import * as serviceRoute4 from '../../apps/services/api/src/app/api/equipments/route'

import * as serviceRoute5 from '../../apps/services/api/src/app/api/equipamentos/search/route'

import * as serviceRoute6 from '../../apps/services/api/src/app/api/equipments/[id]/availability/route'

import * as serviceRoute7 from '../../apps/services/api/src/app/api/settings/public/route'

import * as serviceRoute8 from '../../apps/services/api/src/app/api/equipments/[id]/route'

import * as serviceRoute9 from '../../apps/services/api/src/app/api/public/tenants/[slug]/route'

import * as serviceRoute10 from '../../apps/services/api/src/app/api/auth/organizations/current/route'

const HOSTS = [
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
    const SECRET = 'edge-secret-tenant-not-found-0123456789'
    const ROOT = 'plataforma.test'
    const API = 'https://backend.internal'
    const tenantEdge = (slug: string) => ({
      'x-platform-edge-auth': SECRET,
      'x-platform-host-kind': 'tenant',
      'x-platform-tenant-slug': slug,
      'x-platform-origin': `https://${slug}.${ROOT}`,
    })
    const params = <T extends object>(value: T) => ({
      params: Promise.resolve(value),
    })
    const get = (path: string, headers: Record<string, string> = {}) =>
      new NextRequest(API + path, { headers })
    const post = (
      path: string,
      body: object,
      headers: Record<string, string> = {}
    ) =>
      new NextRequest(API + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      })
    const quote = {
      customerName: 'Cliente',
      customerEmail: 'cliente@example.test',
      customerPhone: '00000000000',
      items: [{ equipmentId: 'eq-1', quantity: 1, days: 1 }],
    }
    const contact = { name: 'Contato', email: 'c@example.test', message: 'Olá' }

    type Call = (_slug: string, _host: boolean) => Promise<Response>
    const q = (slug: string, host: boolean) =>
      host ? '' : `tenantSlug=${encodeURIComponent(slug)}`
    const h = (slug: string, host: boolean) => (host ? tenantEdge(slug) : {})
    const ROUTES: Array<[string, Call]> = [
      [
        'categories',
        (s, host) =>
          categories(get(`/api/categories?${q(s, host)}`, h(s, host))),
      ],
      [
        'equipments',
        (s, host) =>
          equipments(get(`/api/equipments?${q(s, host)}`, h(s, host))),
      ],
      [
        'search',
        (s, host) =>
          search(
            get(`/api/equipamentos/search?q=be&${q(s, host)}`, h(s, host))
          ),
      ],
      [
        'availability',
        (s, host) =>
          availability(
            get(`/api/equipments/eq-1/availability?${q(s, host)}`, h(s, host)),
            params({ id: 'eq-1' })
          ),
      ],
      [
        'settings',
        (s, host) =>
          settings(get(`/api/settings/public?${q(s, host)}`, h(s, host))),
      ],
      [
        'equipment detail',
        (s, host) =>
          equipmentDetail(
            get(`/api/equipments/eq-1?${q(s, host)}`, h(s, host)),
            params({ id: 'eq-1' })
          ),
      ],
      [
        'tenant card',
        (s, host) =>
          tenantCard(
            get(`/api/public/tenants/${encodeURIComponent(s)}`, h(s, host)),
            params({ slug: s })
          ),
      ],
      [
        'quotes',
        (s, host) =>
          postQuote(
            post(
              '/api/quotes',
              host ? quote : { ...quote, tenantSlug: s },
              h(s, host)
            )
          ),
      ],
      [
        'orcamentos',
        (s, host) =>
          postOrcamento(
            post(
              '/api/orcamentos',
              host ? quote : { ...quote, tenantSlug: s },
              h(s, host)
            )
          ),
      ],
      [
        'contact',
        (s, host) =>
          postContact(
            post(
              '/api/contact',
              host ? contact : { ...contact, tenantSlug: s },
              h(s, host)
            )
          ),
      ],
    ]
    /** Rotas que só existem no host de locadora (a locadora vem da borda). */
    const HOST_ONLY: Array<[string, (_slug: string) => Promise<Response>]> = [
      [
        'organizations/current',
        (s) =>
          currentOrganization(
            get('/api/auth/organizations/current', tenantEdge(s))
          ),
      ],
      ['private quotes', (s) => listQuotes(get('/api/quotes', tenantEdge(s)))],
      [
        'private quotes with a selection header',
        (s) =>
          listQuotes(
            get('/api/quotes', {
              ...tenantEdge(s),
              'x-tenant-id': 'tenant-suspensa',
            })
          ),
      ],
    ]

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
      vi.stubEnv('PLATFORM_ENV', 'staging')
      vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
      vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
      vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
      vi.stubEnv('VERCEL_ENV', '')
      state.lookups.length = 0
      state.transactions = 0
      state.userId = 'user-1'
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    describe('unknown, suspended, reserved and invalid tenants share one 404', () => {
      it('the canonical response is a neutral, uncached JSON 404', async () => {
        expect(await snapshot(publicTenantNotFound())).toEqual({
          status: 404,
          headers: [
            ['cache-control', 'no-store'],
            ['content-type', 'application/json'],
          ],
          body: JSON.stringify({ error: 'Locadora não encontrada' }),
        })
      })

      it.each(ROUTES)(
        '%s: explicit and host variants are byte-identical',
        async (_name, call) => {
          const expected = await snapshot(publicTenantNotFound())
          const explicit = [
            'desconhecida',
            'suspensa',
            'api',
            'www',
            'app',
            'equipamentos',
            'Bad_Slug',
            'a--b',
            'x',
            'a'.repeat(64),
          ]
          for (const slug of explicit)
            expect(await snapshot(await call(slug, false))).toEqual(expected)
          for (const slug of ['desconhecida', 'suspensa'])
            expect(await snapshot(await call(slug, true))).toEqual(expected)
          // Inválidos e reservados não consultam o banco; nada da locadora é lido.
          expect(state.lookups).toEqual([
            'desconhecida',
            'suspensa',
            'desconhecida',
            'suspensa',
          ])
          expect(state.transactions).toBe(0)
        }
      )

      it.each(HOST_ONLY)(
        '%s: an unknown or suspended host tenant gets the same 404',
        async (_name, call) => {
          const expected = await snapshot(publicTenantNotFound())
          for (const userId of ['user-1', null]) {
            state.userId = userId
            for (const slug of ['desconhecida', 'suspensa'])
              expect(await snapshot(await call(slug))).toEqual(expected)
          }
          expect(state.transactions).toBe(0)
        }
      )
    })
  }
)
