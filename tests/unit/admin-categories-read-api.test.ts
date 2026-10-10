import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ permission: vi.fn(), categories: vi.fn() }))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('../../apps/services/api/src/host/catalog', () => ({
  listCategories: state.categories,
}))
import { GET as service } from '../../apps/services/api/src/app/api/admin/categories/route'
const principal = {
  tenantId: 'tenant-fixture',
  userId: 'user-fixture',
  membershipId: 'member-fixture',
  role: 'OPERATOR',
}
beforeEach(() => {
  vi.resetAllMocks()
  state.permission.mockResolvedValue({ ok: true, principal })
  state.categories.mockResolvedValue([
    { id: 'category-fixture', _count: { equipments: 2 } },
  ])
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
describe.each([['service', service]] as const)(
  '%s administrative categories read',
  (_host, GET) => {
    const request = (query = '') =>
      new NextRequest(`https://app.platform.test/api/admin/categories${query}`)
    it.each(['', '?userId=foreign&tenantId=foreign&role=ADMIN&limit=1'])(
      'preserves the array, ignores query overrides and requires EQUIPMENTS/READ: %s',
      async (query) => {
        const original = request(query)
        const response = await GET(original)
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(
          await state.categories.mock.results[0]!.value
        )
        expect(state.permission).toHaveBeenCalledExactlyOnceWith(
          original,
          'EQUIPMENTS',
          'READ'
        )
        expect(state.categories).toHaveBeenCalledExactlyOnceWith(principal)
      }
    )
    it('forwards the permission refusal before catalog access', async () => {
      const response = Response.json(
        { error: 'fixture-denied' },
        { status: 403 }
      )
      state.permission.mockResolvedValue({ ok: false, response })
      expect(await GET(request())).toBe(response)
      expect(state.categories).not.toHaveBeenCalled()
    })
    it.each(['permission', 'categories'] as const)(
      'keeps the %s error envelope and logging',
      async (dependency) => {
        const error = new Error('fixture-storage-failure')
        state[dependency].mockRejectedValue(error)
        const response = await GET(request())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro ao buscar categorias',
        })
        expect(console.error).toHaveBeenCalledExactlyOnceWith(
          'Error fetching categories:',
          error
        )
      }
    )
  }
)
