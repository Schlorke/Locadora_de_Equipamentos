import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_SITE } from '../helpers/public-site'

const db = vi.hoisted(() => ({
  organization: vi.fn(),
  categories: vi.fn(),
  transaction: vi.fn(),
  tenantSetting: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findUnique: db.organization },
    $transaction: db.transaction,
  },
}))
vi.mock('@/lib/application-session', () => ({ getServerSession: vi.fn() }))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({
    prisma: {
      organization: { findUnique: db.organization },
      $transaction: db.transaction,
    },
  }),
}))

import { GET as legacy } from '@/app/api/categories/route'
import { GET as service } from '../../apps/services/api/src/app/api/categories/route'

const secret = 'characterization-edge-secret-0123456789'
const edge = (slug: string, auth = secret) => ({
  'x-platform-edge-auth': auth,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': slug,
  'x-platform-origin': `https://${slug}.platform.test`,
})
const rows = [{ id: 'cat-alfa', name: 'Andaimes', _count: { equipments: 2 } }]
const notFound = { error: 'Locadora não encontrada' }
const cases = [
  {
    name: 'sem seleção',
    query: '',
    status: 409,
    body: { error: 'Selecione uma locadora' },
    lookup: false,
  },
  {
    name: 'seleção vazia',
    query: '?tenantSlug=%20%20',
    status: 409,
    body: { error: 'Selecione uma locadora' },
    lookup: false,
  },
  {
    name: 'slug inválido',
    query: '?tenantSlug=Bad_Slug',
    status: 404,
    body: notFound,
    lookup: false,
  },
  {
    name: 'slug reservado',
    query: '?tenantSlug=api',
    status: 404,
    body: notFound,
    lookup: false,
  },
  {
    name: 'slug com espaço',
    query: '?tenantSlug=%20alfa',
    status: 404,
    body: notFound,
    lookup: false,
  },
  {
    name: 'locadora desconhecida',
    query: '?tenantSlug=unknown',
    status: 404,
    body: notFound,
    lookup: true,
  },
  {
    name: 'locadora suspensa',
    query: '?tenantSlug=suspended',
    status: 404,
    body: notFound,
    lookup: true,
  },
  {
    name: 'seleções contraditórias',
    query: '?tenantSlug=alfa&tenantSlug=bravo',
    status: 400,
    body: { error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' },
    lookup: false,
  },
  {
    name: 'seleções iguais',
    query: '?tenantSlug=alfa&tenantSlug=alfa',
    status: 200,
    body: rows,
    lookup: true,
  },
  {
    name: 'seleção explícita mobile',
    query: '?tenantSlug=alfa',
    status: 200,
    body: rows,
    lookup: true,
  },
  {
    name: 'locadora pelo host',
    query: '',
    headers: edge('alfa'),
    status: 200,
    body: rows,
    lookup: true,
  },
  {
    name: 'query conflita com host',
    query: '?tenantSlug=bravo',
    headers: edge('alfa'),
    status: 400,
    body: { error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' },
    lookup: false,
  },
  {
    name: 'borda forjada não seleciona locadora',
    query: '',
    headers: edge('alfa', 'wrong-secret'),
    status: 409,
    body: { error: 'Selecione uma locadora' },
    lookup: false,
  },
  {
    name: 'cookie e header privados não selecionam catálogo',
    query: '',
    headers: {
      cookie: 'selected-tenant-id=tenant-alfa',
      'x-tenant-id': 'tenant-alfa',
    },
    status: 409,
    body: { error: 'Selecione uma locadora' },
    lookup: false,
  },
] as const

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'platform.test')
  vi.stubEnv('PLATFORM_EDGE_SECRET', secret)
  vi.stubEnv('WEB_API_ORIGIN', '')
  db.organization.mockImplementation(
    async ({ where }: { where: { slug: string } }) =>
      where.slug === 'alfa'
        ? { id: 'tenant-alfa', status: 'ACTIVE', ...LIVE_SITE }
        : where.slug === 'suspended'
          ? { id: 'tenant-suspended', status: 'SUSPENDED' }
          : null
  )
  db.categories.mockResolvedValue(rows)
  db.transaction.mockImplementation(async (operation) =>
    operation({
      $queryRaw: db.tenantSetting,
      category: { findMany: db.categories },
    })
  )
})
afterEach(() => vi.unstubAllEnvs())

describe.each([
  ['legado', legacy],
  ['serviço', service],
] as const)('GET /api/categories — %s', (_name, handler) => {
  it.each(cases)('$name', async (scenario) => {
    const response = await handler(
      new Request('https://backend.internal/api/categories' + scenario.query, {
        headers: 'headers' in scenario ? scenario.headers : {},
      })
    )
    expect(response.status).toBe(scenario.status)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(await response.json()).toEqual(scenario.body)
    expect(db.organization).toHaveBeenCalledTimes(scenario.lookup ? 1 : 0)
    if (scenario.status === 200) {
      expect(db.transaction).toHaveBeenCalledTimes(1)
      expect(db.tenantSetting.mock.calls[0]?.[1]).toBe('tenant-alfa')
      expect(db.categories.mock.calls[0]?.[0].where).toEqual({
        tenantId: 'tenant-alfa',
      })
      const viaHost =
        'headers' in scenario && 'x-platform-edge-auth' in scenario.headers
      expect(response.headers.get('cache-control')).toBe(
        viaHost
          ? 'public, max-age=60'
          : 'public, max-age=60, stale-while-revalidate=300'
      )
      expect(response.headers.get('vary')).toBe(viaHost ? 'Host' : null)
      expect(response.headers.get('cdn-cache-control')).toBeNull()
    } else {
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(db.transaction).not.toHaveBeenCalled()
    }
  })

  it.each(['organization', 'categories'] as const)(
    'preserva o 500 genérico em falha de %s',
    async (dependency) => {
      db[dependency].mockRejectedValue(new Error('private-database-detail'))
      const response = await handler(
        new Request('https://backend.internal/api/categories?tenantSlug=alfa')
      )
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao buscar categorias',
      })
      expect(response.headers.get('cache-control')).toBeNull()
    }
  )
})
