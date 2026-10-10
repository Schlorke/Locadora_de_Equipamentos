import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  tx: { $queryRaw: vi.fn(), permission: { findFirst: vi.fn() } },
  trace: [] as string[],
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: state.transaction } }),
}))
import { requireTenantPermission as service } from '../../apps/services/api/src/host/permissions'
import { createTenantPermissionResolver } from '@gb-locacoes/backend/identity'

const principal = {
  tenantId: 'tenant-fixture',
  userId: 'user-fixture',
  membershipId: 'membership-fixture',
  role: 'OPERATOR' as const,
}
const request = () =>
  new Request('https://app.platform.test/api/admin/categories')
it('creating a permission resolver has no identity or database effects', () => {
  const getDatabase = vi.fn()
  const resolveTenantPrincipal = vi.fn()
  const resolver = createTenantPermissionResolver({
    getDatabase,
    resolveTenantPrincipal,
  })
  expect(typeof resolver).toBe('function')
  expect(getDatabase).not.toHaveBeenCalled()
  expect(resolveTenantPrincipal).not.toHaveBeenCalled()
})
beforeEach(() => {
  vi.resetAllMocks()
  state.trace.length = 0
  state.principal.mockImplementation(async () => {
    state.trace.push('principal')
    return { ok: true, principal }
  })
  state.transaction.mockImplementation(async (operation) => {
    state.trace.push('transaction')
    return operation(state.tx)
  })
  state.tx.$queryRaw.mockImplementation(async () => state.trace.push('scope'))
  state.tx.permission.findFirst.mockImplementation(async () => {
    state.trace.push('permission')
    return { id: 'permission-fixture' }
  })
})

describe.each([['service', service]] as const)(
  '%s tenant permission characterization',
  (_host, requirePermission) => {
    it.each([400, 401, 403, 404, 409])(
      'returns the complete principal denial %i unchanged',
      async (status) => {
        const access = {
          ok: false as const,
          response: Response.json({ error: 'fixture-denial' }, { status }),
        }
        state.principal.mockResolvedValue(access)
        expect(await requirePermission(request(), 'EQUIPMENTS', 'READ')).toBe(
          access
        )
        expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it('never authorizes CLIENT using a stored administrative grant', async () => {
      state.principal.mockResolvedValue({
        ok: true,
        principal: { ...principal, role: 'CLIENT' },
      })
      const access = await requirePermission(request(), 'EQUIPMENTS', 'READ')
      expect(access.ok).toBe(false)
      if (access.ok) throw new Error('Expected denial')
      expect(access.response.status).toBe(403)
      expect(await access.response.json()).toEqual({
        error: 'Acesso administrativo não permitido',
      })
      expect(state.transaction).not.toHaveBeenCalled()
    })
    it.each([
      ['EQUIPMENTS', 'READ'],
      ['FINANCIAL', 'WRITE'],
      ['', 'unknown'],
    ])(
      'preserves ADMIN bypass for module/action %s/%s after the principal',
      async (module, action) => {
        const access = {
          ok: true as const,
          principal: { ...principal, role: 'ADMIN' as const },
        }
        state.principal.mockResolvedValue(access)
        const original = request()
        expect(await requirePermission(original, module, action)).toBe(access)
        expect(state.principal).toHaveBeenCalledExactlyOnceWith(original)
        expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it.each(['FINANCIAL', 'OPERATOR'] as const)(
      'queries exactly the tenant, %s role, module and action after identity',
      async (role) => {
        const access = { ok: true as const, principal: { ...principal, role } }
        state.principal.mockImplementation(async () => {
          state.trace.push('principal')
          return access
        })
        const original = request()
        expect(await requirePermission(original, 'EQUIPMENTS', 'READ')).toBe(
          access
        )
        expect(state.principal).toHaveBeenCalledExactlyOnceWith(original)
        expect(state.trace).toEqual([
          'principal',
          'transaction',
          'scope',
          'permission',
        ])
        expect(state.tx.$queryRaw.mock.calls[0]?.[1]).toBe(principal.tenantId)
        expect(state.tx.permission.findFirst).toHaveBeenCalledExactlyOnceWith({
          where: {
            tenantId: principal.tenantId,
            role,
            module: 'EQUIPMENTS',
            action: 'READ',
          },
          select: { id: true },
        })
        expect(state.transaction.mock.calls[0]?.[1]).toEqual({
          timeout: 15_000,
          maxWait: 15_000,
        })
      }
    )
    it.each(['tenant', 'role', 'module', 'action'])(
      'does not reuse a grant of another %s',
      async (field) => {
        state.tx.permission.findFirst.mockImplementation(async ({ where }) => {
          const grant = {
            tenantId: principal.tenantId,
            role: principal.role,
            module: 'EQUIPMENTS',
            action: 'READ',
          }
          const key = field === 'tenant' ? 'tenantId' : field
          const other = { ...grant, [key]: 'foreign' }
          return Object.entries(where).every(
            ([key, value]) => other[key as keyof typeof other] === value
          )
            ? { id: 'foreign' }
            : null
        })
        const access = await requirePermission(request(), 'EQUIPMENTS', 'READ')
        expect(access.ok).toBe(false)
        if (access.ok) throw new Error('Expected denial')
        expect(access.response.status).toBe(403)
        expect(await access.response.json()).toEqual({
          error: 'Permissão insuficiente nesta locadora',
        })
      }
    )
    it('revalidates the permission on every request without caching', async () => {
      expect(
        (await requirePermission(request(), 'EQUIPMENTS', 'READ')).ok
      ).toBe(true)
      state.tx.permission.findFirst.mockResolvedValueOnce(null)
      expect(
        (await requirePermission(request(), 'EQUIPMENTS', 'READ')).ok
      ).toBe(false)
      expect(state.principal).toHaveBeenCalledTimes(2)
      expect(state.tx.permission.findFirst).toHaveBeenCalledTimes(2)
    })
    it.each(['principal', 'permission'] as const)(
      'propagates %s infrastructure failures',
      async (dependency) => {
        const error = new Error('fixture-private-failure')
        if (dependency === 'principal') state.principal.mockRejectedValue(error)
        else state.tx.permission.findFirst.mockRejectedValue(error)
        await expect(
          requirePermission(request(), 'EQUIPMENTS', 'READ')
        ).rejects.toBe(error)
      }
    )
  }
)
