import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { CatalogError } from '@gb-locacoes/backend/catalog'

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  list: vi.fn(),
  check: vi.fn(),
  limiter: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('../../apps/services/api/src/host/catalog', () => ({
  listEquipments: state.list,
}))
vi.mock('../../apps/services/api/src/host/rate-limit', () => ({
  checkRateLimit: state.check,
  adminApiRateLimit: state.limiter,
}))
import { GET as serviceList } from '../../apps/services/api/src/app/api/admin/equipments/route'

const principal = {
  tenantId: 'fixture-company',
  userId: 'fixture-user',
  role: 'OPERATOR',
}
const dto = {
  equipments: [
    {
      id: 'fixture-equipment',
      pricePerDay: 12.5,
      dailyDirect: '17.25',
      purchasePrice: '99999',
      available: false,
      isAvailable: false,
      _count: { quoteItems: 2, rental_items: 1 },
    },
  ],
  pagination: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
}
const request = (query = '') =>
  new NextRequest(`https://fixture.test/api/admin/equipments${query}`)

describe.each([['service', serviceList]] as const)(
  '%s admin equipment list',
  (_name, list) => {
    beforeEach(() => {
      vi.resetAllMocks()
      state.check.mockReturnValue({
        allowed: true,
        headers: { 'X-RateLimit-Limit': '200' },
      })
      state.permission.mockResolvedValue({ ok: true, principal })
      state.list.mockResolvedValue(dto)
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })
    it.each([
      [
        '',
        {
          page: null,
          limit: null,
          search: null,
          categoryId: null,
          isAvailable: null,
        },
      ],
      [
        '?page=2.5&limit=101tail&search=%25_%20&categoryId=foreign&isAvailable=maybe&page=9',
        {
          page: '2.5',
          limit: '101tail',
          search: '%_ ',
          categoryId: 'foreign',
          isAvailable: 'maybe',
        },
      ],
      [
        '?page=&limit=&search=&categoryId=all&isAvailable=',
        { page: '', limit: '', search: '', categoryId: 'all', isAvailable: '' },
      ],
    ])(
      'forwards the original request and raw first query values (%s)',
      async (query, filters) => {
        const original = request(query)
        const response = await list(original)
        expect(state.check).toHaveBeenCalledExactlyOnceWith(
          original,
          state.limiter
        )
        expect(state.permission).toHaveBeenCalledExactlyOnceWith(
          original,
          'EQUIPMENTS',
          'READ'
        )
        expect(state.list).toHaveBeenCalledExactlyOnceWith(principal, filters)
        expect(state.check.mock.invocationCallOrder[0]).toBeLessThan(
          state.permission.mock.invocationCallOrder[0]!
        )
        expect(state.permission.mock.invocationCallOrder[0]).toBeLessThan(
          state.list.mock.invocationCallOrder[0]!
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(dto)
        expect(response.headers.get('x-ratelimit-limit')).toBeNull()
        expect(response.headers.get('set-cookie')).toBeNull()
      }
    )
    it('returns the original rate refusal before permission or parsing', async () => {
      const denial = Response.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
      state.check.mockReturnValue({
        allowed: false,
        response: denial,
        headers: {},
      })
      const original = request('?page=invalid')
      expect(await list(original)).toBe(denial)
      expect(state.permission).not.toHaveBeenCalled()
      expect(state.list).not.toHaveBeenCalled()
    })
    it.each([400, 401, 403, 404, 409])(
      'returns the original %i permission refusal before catalog',
      async (status) => {
        const denial = Response.json(
          { error: 'fixture denial' },
          { status, headers: { 'Cache-Control': 'private, no-store' } }
        )
        state.permission.mockResolvedValue({ ok: false, response: denial })
        expect(await list(request('?page=invalid'))).toBe(denial)
        expect(state.list).not.toHaveBeenCalled()
      }
    )
    it.each([400, 404, 409] as const)(
      'preserves CatalogError %i',
      async (status) => {
        state.list.mockRejectedValue(
          new CatalogError('Fixture validation', status)
        )
        const response = await list(request())
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual({ error: 'Fixture validation' })
        expect(console.error).not.toHaveBeenCalled()
      }
    )
    it.each(['check', 'permission', 'list'] as const)(
      'preserves production %s failure and logging',
      async (part) => {
        vi.stubEnv('NODE_ENV', 'production')
        const error = Object.assign(
          new Error('private infrastructure message'),
          {
            code: 'P2010',
            meta: { private: true },
          }
        )
        if (part === 'check')
          state.check.mockImplementation(() => {
            throw error
          })
        else state[part].mockRejectedValue(error)
        const response = await list(request())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro interno do servidor ao buscar equipamentos.',
        })
        expect(vi.mocked(console.error).mock.calls).toEqual([
          ['[API GET /admin/equipments] ERRO CRÍTICO:', error],
          ['[API GET /admin/equipments] Mensagem do erro:', error.message],
          ['[API GET /admin/equipments] Stack trace:', error.stack],
          ['[API GET /admin/equipments] Erro do Prisma - Código:', error.code],
          ['[API GET /admin/equipments] Erro do Prisma - Meta:', error.meta],
        ])
      }
    )
    it.each([new Error('fixture failure'), 'fixture non-Error'])(
      'keeps development details for %s',
      async (error) => {
        vi.stubEnv('NODE_ENV', 'development')
        state.list.mockRejectedValue(error)
        const response = await list(request())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro interno do servidor ao buscar equipamentos.',
          details: error instanceof Error ? error.message : String(error),
        })
      }
    )
  }
)
