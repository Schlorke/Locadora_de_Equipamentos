import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { CatalogError } from '@gb-locacoes/backend/catalog'
const state = vi.hoisted(() => ({
  permission: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
}))
vi.mock('@/lib/tenant-permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  adminApiRateLimit: {},
}))
vi.mock('../../apps/services/api/src/host/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  adminApiRateLimit: {},
}))
vi.mock('@/lib/catalog', async () => {
  const { CatalogError } = await import('@gb-locacoes/backend/catalog')
  return {
    CatalogError,
    createEquipment: state.create,
    listEquipments: state.list,
  }
})
vi.mock('../../apps/services/api/src/host/catalog', () => ({
  createEquipment: state.create,
  listEquipments: state.list,
}))
import { POST as legacy } from '../../app/api/admin/equipments/route'
import { POST as api } from '../../apps/services/api/src/app/api/admin/equipments/route'
const request = () =>
  new NextRequest('http://localhost/api/admin/equipments', {
    method: 'POST',
    body: JSON.stringify({ name: 'Equipment' }),
    headers: { 'content-type': 'application/json' },
  })
beforeEach(() => {
  vi.resetAllMocks()
  state.permission.mockResolvedValue({
    ok: true,
    principal: { tenantId: 'alfa' },
  })
})
describe.each([
  ['legacy', legacy],
  ['api', api],
] as const)('%s equipment admission HTTP contract', (_host, post) => {
  it.each([
    [
      402,
      {
        error: 'Limite alcançado',
        code: 'PLAN_LIMIT_REACHED',
        resource: 'equipments',
        limit: 2,
        used: 2,
      },
    ],
    [402, { error: 'Somente leitura', code: 'SUBSCRIPTION_RESTRICTED' }],
    [403, { error: 'Arquivada', code: 'TENANT_ARCHIVED' }],
    [503, { error: 'Não foi possível verificar os limites do plano.' }],
    [404, { error: 'Categoria não encontrada.' }],
  ] as const)(
    'preserves status %s and exact safe envelope %j',
    async (status, body) => {
      state.create.mockRejectedValue(new CatalogError(body.error, status, body))
      const response = await post(request())
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual(body)
    }
  )
  it('preserves the 201 response and does not duplicate admission in HTTP', async () => {
    const equipment = {
      id: 'equipment-fixture',
      pricePerDay: 10,
      isAvailable: true,
    }
    state.create.mockResolvedValue(equipment)
    const response = await post(request())
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(equipment)
    expect(state.create).toHaveBeenCalledWith(
      { tenantId: 'alfa' },
      { name: 'Equipment' }
    )
  })
  it('keeps RBAC denial ahead of quota and INSERT', async () => {
    state.permission.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Access denied' }, { status: 403 }),
    })
    expect((await post(request())).status).toBe(403)
    expect(state.create).not.toHaveBeenCalled()
  })
})
