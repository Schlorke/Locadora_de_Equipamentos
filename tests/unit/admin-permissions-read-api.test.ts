import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  permissions: vi.fn(),
  trace: [] as string[],
}))
vi.mock('@/lib/tenant', () => ({
  resolveTenantPrincipal: state.principal,
  withTenantTransaction: state.transaction,
}))
import { GET as legacy } from '@/app/api/admin/permissions/route'
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: vi.fn() } }),
}))
vi.mock('../../apps/services/api/src/host/permission-rows', async () => {
  const { listTenantPermissions } =
    await import('@gb-locacoes/backend/identity')
  return {
    readPermissionRows: (context: { tenantId: string }) =>
      state.transaction(context, (transaction: never) =>
        listTenantPermissions(transaction, context)
      ),
  }
})
import { GET as service } from '../../apps/services/api/src/app/api/admin/permissions/route'

const principal = {
  tenantId: 'tenant-fixture',
  userId: 'user-fixture',
  membershipId: 'membership-fixture',
  role: 'ADMIN',
}
const rows = [
  {
    id: 'permission-fixture',
    tenantId: principal.tenantId,
    role: 'CLIENT',
    module: 'CONTRACTS',
    action: 'READ',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  },
]
beforeEach(() => {
  vi.resetAllMocks()
  state.trace.length = 0
  state.principal.mockImplementation(async () => {
    state.trace.push('principal')
    return { ok: true, principal }
  })
  state.transaction.mockImplementation(async (_context, operation) => {
    state.trace.push('transaction')
    return operation({ permission: { findMany: state.permissions } })
  })
  state.permissions.mockImplementation(async () => {
    state.trace.push('permissions')
    return rows
  })
})

describe.each([
  ['legacy', legacy],
  ['service', service],
] as const)(
  '%s administrative permissions read characterization',
  (_host, GET) => {
    const request = (query = '') =>
      new NextRequest(`https://app.platform.test/api/admin/permissions${query}`)
    it.each([
      '',
      '?tenantId=foreign&userId=foreign&role=CLIENT&module=USERS&limit=1&orderBy=createdAt',
    ])(
      'keeps all fields, ordering and authenticated tenant, ignoring query: %s',
      async (query) => {
        const original = request(query)
        const response = await GET(original)
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
          permissions: JSON.parse(JSON.stringify(rows)),
        })
        expect(response.headers.get('cache-control')).toBeNull()
        expect(response.headers.get('vary')).toBeNull()
        expect(response.headers.get('set-cookie')).toBeNull()
        expect(state.principal).toHaveBeenCalledExactlyOnceWith(original)
        expect(state.transaction.mock.calls[0]![0]).toBe(principal)
        expect(state.permissions).toHaveBeenCalledExactlyOnceWith({
          where: { tenantId: principal.tenantId },
          orderBy: [{ role: 'asc' }, { module: 'asc' }, { action: 'asc' }],
        })
        expect(state.trace).toEqual(['principal', 'transaction', 'permissions'])
      }
    )
    it.each([400, 401, 403, 404, 409, 503])(
      'returns the complete principal refusal %i before any permission read',
      async (status) => {
        const refusal = Response.json(
          { error: 'fixture-denial' },
          {
            status,
            headers: {
              'cache-control': 'private, no-store',
              Vary: 'Cookie, Host',
            },
          }
        )
        state.principal.mockResolvedValue({ ok: false, response: refusal })
        expect(await GET(request())).toBe(refusal)
        expect(state.transaction).not.toHaveBeenCalled()
        expect(state.permissions).not.toHaveBeenCalled()
      }
    )
    it.each(['CLIENT', 'FINANCIAL', 'OPERATOR'])(
      'refuses the %s membership even if a permission row exists',
      async (role) => {
        state.principal.mockResolvedValue({
          ok: true,
          principal: { ...principal, role },
        })
        const response = await GET(request('?role=ADMIN'))
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'Não autorizado' })
        expect(state.transaction).not.toHaveBeenCalled()
        expect(state.permissions).not.toHaveBeenCalled()
      }
    )
    it('returns an empty permissions array for the authorized empty tenant', async () => {
      state.permissions.mockResolvedValue([])
      expect(await (await GET(request())).json()).toEqual({ permissions: [] })
    })
    it.each(['principal', 'transaction', 'permissions'] as const)(
      'lets the %s failure reach the HTTP framework unchanged',
      async (dependency) => {
        const failure = new Error('fixture-private-storage-failure')
        state[dependency].mockRejectedValue(failure)
        await expect(GET(request())).rejects.toBe(failure)
        if (dependency === 'principal')
          expect(state.transaction).not.toHaveBeenCalled()
      }
    )
  }
)
