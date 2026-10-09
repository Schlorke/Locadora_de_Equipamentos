import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { CatalogError } from '@gb-locacoes/backend/catalog'

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
}))
vi.mock('@/lib/tenant-permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('@/lib/catalog', async () => {
  const { CatalogError } = await import('@gb-locacoes/backend/catalog')
  return {
    CatalogError,
    listUnits: state.list,
    readUnit: state.read,
    createUnit: vi.fn(),
    updateUnit: vi.fn(),
    deleteUnit: vi.fn(),
  }
})
import { GET as legacyList } from '@/app/api/admin/equipment-units/route'
import { GET as legacyRead } from '@/app/api/admin/equipment-units/[id]/route'
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('../../apps/services/api/src/host/catalog', () => ({
  listUnits: state.list,
  readUnit: state.read,
}))
import { GET as serviceList } from '../../apps/services/api/src/app/api/admin/equipment-units/route'
import { GET as serviceRead } from '../../apps/services/api/src/app/api/admin/equipment-units/[id]/route'

const principal = {
  tenantId: 'tenant-fixture',
  userId: 'user-fixture',
  membershipId: 'member-fixture',
  role: 'OPERATOR',
}
const unit = {
  id: 'unit-fixture',
  tenantId: principal.tenantId,
  equipmentId: 'equipment-fixture',
  uniqueCode: 'Unit-001',
  serialNumber: null,
  notes: 'Private unit note',
  hourMeter: '12.345',
  odometer: '987.65',
  status: 'AVAILABLE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  equipment: {
    id: 'equipment-fixture',
    name: 'Fixture machine',
    category: { name: 'Fixture category' },
  },
}
const request = (query = '') =>
  new NextRequest(`https://app.platform.test/api/admin/equipment-units${query}`)
beforeEach(() => {
  vi.resetAllMocks()
  state.permission.mockResolvedValue({ ok: true, principal })
  state.list.mockResolvedValue([unit])
  state.read.mockResolvedValue(unit)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe.each([
  ['legacy', legacyList, legacyRead],
  ['service', serviceList, serviceRead],
] as const)('%s equipment units reads', (_host, list, read) => {
  it.each([
    ['', { equipmentId: null, status: null, search: null }],
    [
      '?equipmentId=&status=&search=',
      { equipmentId: '', status: '', search: '' },
    ],
    [
      '?equipmentId=equipment-fixture&status=RENTED&search=AbC',
      { equipmentId: 'equipment-fixture', status: 'RENTED', search: 'AbC' },
    ],
    [
      '?equipmentId=one&equipmentId=two&status=AVAILABLE&status=RENTED&search=first&search=last',
      { equipmentId: 'one', status: 'AVAILABLE', search: 'first' },
    ],
    [
      '?search=%25_%20%2B%C3%A7&status=invalid&tenantId=foreign&userId=other&role=ADMIN&limit=1&orderBy=createdAt',
      { equipmentId: null, status: 'invalid', search: '%_ +ç' },
    ],
  ] as const)(
    'forwards the raw filters and original permission request: %s',
    async (query, filters) => {
      const original = request(query)
      const response = await list(original)
      expect(state.permission).toHaveBeenCalledExactlyOnceWith(
        original,
        'EQUIPMENTS',
        'READ'
      )
      expect(state.list).toHaveBeenCalledExactlyOnceWith(principal, filters)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual([unit])
    }
  )
  it('keeps the empty list as a bare array', async () => {
    state.list.mockResolvedValue([])
    expect(await (await list(request())).json()).toEqual([])
  })
  it.each([400, 401, 403, 404, 409])(
    'returns the permission denial %i before list data or detail params',
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
      expect(await list(request())).toBe(denied)
      const then = vi.fn()
      const params = { then } as unknown as Promise<{ id: string }>
      expect(await read(request(), { params })).toBe(denied)
      expect(then).not.toHaveBeenCalled()
      expect(state.list).not.toHaveBeenCalled()
      expect(state.read).not.toHaveBeenCalled()
    }
  )
  it('preserves the full detail DTO and uses the promised route ID instead of query', async () => {
    const original = request('?id=foreign&tenantId=foreign&role=ADMIN')
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
    expect(await response.json()).toEqual(unit)
  })
  it.each([404, 409] as const)(
    'keeps a CatalogError %i from detail without logging a generic error',
    async (status) => {
      state.read.mockRejectedValue(
        new CatalogError('Fixture catalog refusal', status)
      )
      const response = await read(request(), {
        params: Promise.resolve({ id: unit.id }),
      })
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({
        error: 'Fixture catalog refusal',
      })
      expect(console.error).not.toHaveBeenCalled()
    }
  )
  it.each(['permission', 'list'] as const)(
    'keeps the list %s exception envelope and logging',
    async (kind) => {
      const error = new Error('Fixture infrastructure failure')
      state[kind].mockRejectedValue(error)
      const response = await list(request())
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao buscar unidades',
      })
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        'Erro ao buscar unidades:',
        error
      )
    }
  )
  it('list keeps its generic 500 even when catalog throws a typed error', async () => {
    state.list.mockRejectedValue(new CatalogError('Fixture refusal', 404))
    const response = await list(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Erro ao buscar unidades' })
  })
  it.each(['permission', 'read', 'params'] as const)(
    'keeps the detail %s exception envelope and logging',
    async (kind) => {
      const error = new Error('Fixture infrastructure failure')
      let params = Promise.resolve({ id: unit.id })
      if (kind === 'params') {
        params = Promise.reject(error)
        void params.catch(() => undefined)
      } else state[kind].mockRejectedValue(error)
      const response = await read(request(), { params })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Erro ao buscar unidade' })
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        'Erro ao buscar unidade:',
        error
      )
    }
  )
})
