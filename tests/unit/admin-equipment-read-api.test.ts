import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { CatalogError } from '@gb-locacoes/backend/catalog'

const state = vi.hoisted(() => ({ permission: vi.fn(), read: vi.fn() }))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('../../apps/services/api/src/host/catalog', () => ({
  readEquipment: state.read,
}))
import { GET as serviceRead } from '../../apps/services/api/src/app/api/admin/equipments/[id]/route'

const principal = {
  tenantId: 'fixture-tenant',
  userId: 'fixture-user',
  membershipId: 'fixture-membership',
  role: 'FINANCIAL',
}
const equipment = {
  id: 'fixture-equipment',
  tenantId: principal.tenantId,
  name: 'Fixture equipment',
  category: { id: 'fixture-category', name: 'Fixture category' },
  pricePerDay: 12.5,
  dailyDirectValue: '17.25',
  purchasePrice: '99999',
  available: true,
  isAvailable: true,
  images: [],
  hourMeter: null,
  specifications: { internal: 'fixture-private' },
  _count: { quoteItems: 2, reviews: 0 },
}
function request() {
  return new NextRequest(
    'http://localhost/api/admin/equipments/route-id?id=foreign&tenantId=foreign&role=CLIENT'
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  state.permission.mockResolvedValue({ ok: true, principal })
  state.read.mockResolvedValue(equipment)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe.each([['service', serviceRead]] as const)(
  '%s administrative equipment detail',
  (_host, read) => {
    it('uses the original Request and promised ID, preserving the complete DTO', async () => {
      const original = request()
      const response = await read(original, {
        params: Promise.resolve({ id: 'literal %_ id' }),
      })
      expect(state.permission).toHaveBeenCalledExactlyOnceWith(
        original,
        'EQUIPMENTS',
        'READ'
      )
      expect(state.read).toHaveBeenCalledExactlyOnceWith(
        principal,
        'literal %_ id'
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(equipment)
      expect(response.headers.get('set-cookie')).toBeNull()
    })
    it.each([400, 401, 403, 404, 409])(
      'returns the original %i denial before data and params',
      async (status) => {
        const denied = Response.json(
          { error: 'fixture-denial' },
          {
            status,
            headers: {
              'Cache-Control': 'private, no-store',
              Vary: 'Cookie, Host',
            },
          }
        )
        state.permission.mockResolvedValue({ ok: false, response: denied })
        const then = vi.fn()
        expect(
          await read(request(), {
            params: { then } as unknown as Promise<{ id: string }>,
          })
        ).toBe(denied)
        expect(then).not.toHaveBeenCalled()
        expect(state.read).not.toHaveBeenCalled()
      }
    )
    it.each([400, 404, 409] as const)(
      'keeps CatalogError %i and its message without generic logging',
      async (status) => {
        state.read.mockRejectedValue(
          new CatalogError('Fixture refusal', status)
        )
        const response = await read(request(), {
          params: Promise.resolve({ id: equipment.id }),
        })
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual({ error: 'Fixture refusal' })
        expect(console.error).not.toHaveBeenCalled()
      }
    )
    it.each(['permission', 'read', 'params'] as const)(
      'keeps generic %s failure and exact logging',
      async (kind) => {
        const error = new Error('Fixture infrastructure failure')
        let params = Promise.resolve({ id: equipment.id })
        if (kind === 'params') {
          params = Promise.reject(error)
          void params.catch(() => undefined)
        } else state[kind].mockRejectedValue(error)
        const response = await read(request(), { params })
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro interno do servidor',
        })
        expect(console.error).toHaveBeenCalledExactlyOnceWith(
          'Erro ao buscar equipamento:',
          error
        )
      }
    )
    it('keeps a non-Error failure generic', async () => {
      state.read.mockRejectedValue('fixture failure')
      const response = await read(request(), {
        params: Promise.resolve({ id: equipment.id }),
      })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro interno do servidor',
      })
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        'Erro ao buscar equipamento:',
        'fixture failure'
      )
    })
    it('waits for permission before resolving params or calling catalog', async () => {
      let permit!: (_value: { ok: true; principal: typeof principal }) => void
      state.permission.mockReturnValue(
        new Promise((resolve) => {
          permit = resolve
        })
      )
      const then = vi.fn((resolve: (_value: { id: string }) => void) =>
        resolve({ id: equipment.id })
      )
      const response = read(request(), {
        params: { then } as unknown as Promise<{ id: string }>,
      })
      await Promise.resolve()
      expect(then).not.toHaveBeenCalled()
      expect(state.read).not.toHaveBeenCalled()
      permit({ ok: true, principal })
      expect((await response).status).toBe(200)
      expect(then).toHaveBeenCalledOnce()
      expect(state.read).toHaveBeenCalledExactlyOnceWith(
        principal,
        equipment.id
      )
    })
  }
)
