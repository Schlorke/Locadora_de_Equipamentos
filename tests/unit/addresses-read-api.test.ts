import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  tx: { $queryRaw: vi.fn(), address: { findMany: vi.fn() } },
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: state.transaction } }),
}))
import { GET as service } from '../../apps/services/api/src/app/api/addresses/route'

const principal = {
  tenantId: 'tenant-fixture',
  userId: 'user-fixture',
  membershipId: 'membership-fixture',
  role: 'CLIENT' as const,
}
const saved = {
  id: 'address-fixture',
  tenantId: principal.tenantId,
  userId: principal.userId,
  street: 'Fixture street',
  number: '1',
  complement: null,
  neighborhood: 'Fixture neighborhood',
  city: 'Fixture city',
  state: 'SP',
  zipCode: '01001000',
  isPrimary: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
}
beforeEach(() => {
  vi.resetAllMocks()
  state.principal.mockResolvedValue({ ok: true, principal })
  state.transaction.mockImplementation(async (operation) => operation(state.tx))
  state.tx.address.findMany.mockResolvedValue([saved])
})

describe.each([['service', service]] as const)(
  '%s address read characterization',
  (_host, GET) => {
    const request = (query = '') =>
      new NextRequest(`https://api.platform.test/api/addresses${query}`)
    it.each([400, 401, 403, 404, 409])(
      'returns principal denial %i unchanged before storage',
      async (status) => {
        const denial = Response.json(
          { error: 'fixture-denied' },
          { status, headers: { 'Cache-Control': 'no-store' } }
        )
        state.principal.mockResolvedValue({ ok: false, response: denial })
        expect(await GET(request())).toBe(denial)
        expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'])(
      'reads only the current identity addresses for membership role %s',
      async (role) => {
        const input = request()
        const actor = { ...principal, role }
        state.principal.mockResolvedValue({ ok: true, principal: actor })
        const response = await GET(input)
        expect(state.principal).toHaveBeenCalledExactlyOnceWith(input)
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
          addresses: [JSON.parse(JSON.stringify(saved))],
        })
        expect(state.tx.$queryRaw.mock.calls[0]?.[1]).toBe(actor.tenantId)
        expect(state.tx.address.findMany).toHaveBeenCalledExactlyOnceWith({
          where: { tenantId: actor.tenantId, userId: actor.userId },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        })
        expect(response.headers.get('cache-control')).toBeNull()
        expect(response.headers.get('set-cookie')).toBeNull()
      }
    )
    it.each([
      '?userId=foreign&tenantId=foreign&role=ADMIN',
      '?isPrimary=false&orderBy=street&limit=1',
    ])('ignores non-contract query fields: %s', async (query) => {
      expect((await GET(request(query))).status).toBe(200)
      expect(state.tx.address.findMany).toHaveBeenCalledWith({
        where: { tenantId: principal.tenantId, userId: principal.userId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      })
    })
    it('keeps the empty collection envelope', async () => {
      state.tx.address.findMany.mockResolvedValue([])
      expect(await (await GET(request())).json()).toEqual({ addresses: [] })
    })
    it('sanitizes a business storage failure using the existing message', async () => {
      state.tx.address.findMany.mockRejectedValue(new Error('private-detail'))
      const response = await GET(request())
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao buscar endereços',
      })
    })
    it('keeps principal dependency failures outside the business catch', async () => {
      const failure = new Error('fixture-principal-failure')
      state.principal.mockRejectedValue(failure)
      await expect(GET(request())).rejects.toBe(failure)
      expect(state.transaction).not.toHaveBeenCalled()
    })
  }
)
