import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  trace: [] as string[],
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('../../apps/services/api/src/host/tenant-transaction', () => ({
  withTenantTransaction: state.transaction,
}))
import { PUT as service } from '../../apps/services/api/src/app/api/admin/permissions/route'
import * as serviceSeed from '../../apps/services/api/src/app/api/admin/seed-admin/route'
import * as serviceLogin from '../../apps/services/api/src/app/api/test-login/route'
import * as serviceStorage from '../../apps/services/api/src/app/api/fix-storage/route'
import * as serviceSetup from '../../apps/services/api/src/app/api/supabase-setup/route'
import * as serviceUnknown from '../../apps/services/api/src/app/api/[...rest]/route'

const principal = {
  tenantId: 'tenant-local',
  userId: 'user-local',
  membershipId: 'member-local',
  role: 'ADMIN',
}
const grant = { role: 'OPERATOR', module: 'FINANCIAL', action: 'READ' }
const row = {
  ...grant,
  id: 'row-local',
  tenantId: principal.tenantId,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
}
function req(body: unknown = { permissions: [grant] }, query = '') {
  return new NextRequest(
    'https://app.platform.test/api/admin/permissions' + query,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  state.trace.length = 0
  state.principal.mockResolvedValue({ ok: true, principal })
  state.transaction.mockImplementation(async (_scope, operation) =>
    operation({
      $executeRaw: state.lock,
      permission: {
        deleteMany: state.remove,
        createMany: state.create,
        findMany: state.read,
      },
    })
  )
  for (const [name, fn] of [
    ['lock', state.lock],
    ['delete', state.remove],
    ['create', state.create],
    ['read', state.read],
  ] as const)
    fn.mockImplementation(async () => {
      state.trace.push(name)
      return name === 'read' ? [row] : { count: 1 }
    })
})
describe.each([['service', service]] as const)(
  '%s permission replacement characterization',
  (_host, PUT) => {
    it.each([401, 403, 409])(
      'returns principal refusal %s before reading malformed input or SQL',
      async (code) => {
        const denial = Response.json({ error: 'Denied' }, { status: code })
        state.principal.mockResolvedValue({ ok: false, response: denial })
        expect(await PUT(req('{'))).toBe(denial)
        expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it.each(['OPERATOR', 'FINANCIAL', 'CLIENT'])(
      'requires ADMIN membership even for %s',
      async (role) => {
        state.principal.mockResolvedValue({
          ok: true,
          principal: { ...principal, role },
        })
        const response = await PUT(req('{'))
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'Não autorizado' })
        expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it('locks tenant and role, then replaces only that role atomically, strips unknown fields and returns raw row DTO', async () => {
      const r = await PUT(
        req(
          {
            tenantId: 'foreign',
            permissions: [{ ...grant, tenantId: 'foreign', id: 'fake' }],
          },
          '?tenantId=foreign&role=CLIENT'
        )
      )
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({
        success: true,
        permissions: [
          {
            ...row,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          },
        ],
      })
      expect(state.transaction.mock.calls[0]![0]).toEqual(principal)
      expect(state.lock.mock.calls[0]![0].join('?')).toBe(
        'SELECT pg_advisory_xact_lock(hashtextextended(?, 0))'
      )
      expect(state.lock.mock.calls[0]![1]).toBe(
        'tenant-local:permissions:OPERATOR'
      )
      expect(state.trace).toEqual(['lock', 'delete', 'create', 'read'])
      expect(state.remove).toHaveBeenCalledWith({
        where: { tenantId: principal.tenantId, role: 'OPERATOR' },
      })
      expect(state.create).toHaveBeenCalledWith({
        data: [{ ...grant, tenantId: principal.tenantId }],
        skipDuplicates: true,
      })
      expect(state.read).toHaveBeenCalledWith({
        where: { tenantId: principal.tenantId, role: 'OPERATOR' },
      })
    })
    it('awaits the advisory lock before deleting existing grants', async () => {
      let release!: () => void
      state.lock.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          })
      )
      const pending = PUT(req())
      await vi.waitFor(() => expect(state.lock).toHaveBeenCalled())
      expect(state.remove).not.toHaveBeenCalled()
      release()
      expect((await pending).status).toBe(200)
    })
    it('passes duplicates to createMany with skipDuplicates and preserves same-role input', async () => {
      const r = await PUT(req({ permissions: [grant, grant] }))
      expect(r.status).toBe(200)
      expect(state.create.mock.calls[0]![0].data).toHaveLength(2)
      expect(state.create.mock.calls[0]![0].skipDuplicates).toBe(true)
    })
    it.each([
      null,
      {},
      { permissions: [] },
      { permissions: Array(101).fill(grant) },
      { permissions: [grant, { ...grant, role: 'CLIENT' }] },
      { permissions: [{ ...grant, role: 'ADMIN' }] },
      { permissions: [{ ...grant, module: 'UNKNOWN' }] },
      { permissions: [{ ...grant, action: 'UNKNOWN' }] },
      { permissions: 'OPERATOR' },
      { permissions: [null] },
    ])(
      'keeps zod error envelope and zero writes for invalid input %#',
      async (body) => {
        const r = await PUT(req(body))
        expect(r.status).toBe(400)
        const dto = await r.json()
        expect(dto.error).toBe('Dados inválidos')
        expect(dto.details.length).toBeGreaterThan(0)
        expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it.each(['OPERATOR', 'FINANCIAL', 'CLIENT'])(
      'keeps supported target role %s',
      async (role) => {
        expect(
          (await PUT(req({ permissions: [{ ...grant, role }] }))).status
        ).toBe(200)
        expect(state.remove.mock.calls[0]![0].where.role).toBe(role)
      }
    )
    it('accepts exactly 100 grants', async () =>
      expect(
        (await PUT(req({ permissions: Array(100).fill(grant) }))).status
      ).toBe(200))
    it('keeps malformed JSON as generic 500', async () => {
      const r = await PUT(req('{'))
      expect(r.status).toBe(500)
      expect(await r.json()).toEqual({ error: 'Erro ao atualizar permissões' })
      expect(state.transaction).not.toHaveBeenCalled()
    })
    it.each(['principal', 'transaction', 'lock', 'remove', 'create', 'read'])(
      'sanitizes unexpected failures at %s',
      async (boundary) => {
        state[boundary as 'principal'].mockRejectedValue(
          new Error('private SQL password')
        )
        const r = await PUT(req())
        expect(r.status).toBe(500)
        expect(await r.json()).toEqual({
          error: 'Erro ao atualizar permissões',
        })
      }
    )
  }
)
describe('retired operations and unknown endpoint characterization', () => {
  // F: duplicate deleted-root endpoint case; existing service endpoint case below retains its literal DTO and zero-effect checks.
  // F: duplicate deleted-root endpoint case; existing service endpoint case below retains its literal DTO and zero-effect checks.
  it.each([
    ['seed GET', serviceSeed.GET],
    ['seed POST', serviceSeed.POST],
    ['login', serviceLogin.POST],
    ['storage', serviceStorage.POST],
    ['setup GET', serviceSetup.GET],
    ['setup POST', serviceSetup.POST],
  ] as const)('service %s stays inert 410', async (_name, handler) => {
    const response = handler()
    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ error: 'Endpoint retired' })
    expect(state.principal).not.toHaveBeenCalled()
    expect(state.transaction).not.toHaveBeenCalled()
  })
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    'service %s unknown route keeps the exact inert 404',
    async (method) => {
      const response = serviceUnknown[method]()
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Not Found',
        message: 'Endpoint não encontrado não encontrado',
        code: 'NOT_FOUND',
      })
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(state.principal).not.toHaveBeenCalled()
      expect(state.transaction).not.toHaveBeenCalled()
    }
  )
})
