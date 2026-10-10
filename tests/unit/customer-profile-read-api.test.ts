import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { CustomerError } from '@gb-locacoes/backend/customers'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  tx: { $queryRaw: vi.fn(), clientProfile: { findUnique: vi.fn() } },
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: state.transaction } }),
}))
import { GET as service } from '../../apps/services/api/src/app/api/user/profile/route'

const principal = {
  tenantId: 'fixture-tenant',
  userId: 'fixture-user',
  membershipId: 'fixture-member',
  role: 'CLIENT' as const,
}
const saved = {
  id: 'fixture-profile',
  tenantId: principal.tenantId,
  userId: principal.userId,
  name: 'Tenant commercial name',
  email: 'commercial@example.test',
  phone: '11999999999',
  document: '12345678901',
  company: 'Tenant company',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
}
const expected = {
  id: principal.userId,
  name: saved.name,
  email: saved.email,
  phone: saved.phone,
  cpf: saved.document,
  cnpj: null,
  company: saved.company,
}
beforeEach(() => {
  vi.resetAllMocks()
  state.principal.mockResolvedValue({ ok: true, principal })
  state.transaction.mockImplementation(async (operation) => operation(state.tx))
  state.tx.clientProfile.findUnique.mockResolvedValue(saved)
})

describe.each([['service', service]] as const)(
  '%s commercial profile GET characterization',
  (_host, GET) => {
    const request = (query = '') =>
      new NextRequest(`https://app.platform.test/api/user/profile${query}`)
    it.each([400, 401, 403, 404, 409, 503])(
      'preserves principal refusal %i before a profile query',
      async (status) => {
        const refusal = Response.json(
          { error: 'fixture-denied' },
          { status, headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } }
        )
        state.principal.mockResolvedValue({ ok: false, response: refusal })
        expect(await GET(request())).toBe(refusal)
        expect(state.transaction).not.toHaveBeenCalled()
        expect(state.tx.clientProfile.findUnique).not.toHaveBeenCalled()
      }
    )
    it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'])(
      'reads only the current user and tenant for %s',
      async (role) => {
        const input = request(
          '?userId=foreign&tenantId=foreign&role=ADMIN&fields=password'
        )
        state.principal.mockResolvedValue({
          ok: true,
          principal: { ...principal, role },
        })
        const response = await GET(input)
        expect(state.principal).toHaveBeenCalledExactlyOnceWith(input)
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(response.headers.get('vary')).toBeNull()
        expect(response.headers.get('set-cookie')).toBeNull()
        expect(await response.json()).toEqual({ user: expected })
        expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(principal.tenantId)
        expect(
          state.tx.clientProfile.findUnique
        ).toHaveBeenCalledExactlyOnceWith({
          where: {
            tenantId_userId: {
              tenantId: principal.tenantId,
              userId: principal.userId,
            },
          },
        })
      }
    )
    it.each([
      ['12345678901', '12345678901', null],
      ['12345678000199', null, '12345678000199'],
      ['12ABC678000199', null, '12ABC678000199'],
      ['123.456.789-01', null, '123.456.789-01'],
      ['', null, null],
      [null, null, null],
      ['123', null, null],
    ])(
      'preserves document classification by raw length: %j',
      async (document, cpf, cnpj) => {
        state.tx.clientProfile.findUnique.mockResolvedValue({
          ...saved,
          document,
        })
        expect(await (await GET(request())).json()).toEqual({
          user: { ...expected, cpf, cnpj },
        })
      }
    )
    it('keeps null commercial values rather than falling back to global user data', async () => {
      state.tx.clientProfile.findUnique.mockResolvedValue({
        ...saved,
        email: null,
        phone: null,
        document: null,
        company: null,
      })
      expect(await (await GET(request())).json()).toEqual({
        user: {
          ...expected,
          email: null,
          phone: null,
          cpf: null,
          company: null,
        },
      })
    })
    it('keeps missing profile as 404 and never creates or substitutes a profile', async () => {
      state.tx.clientProfile.findUnique.mockResolvedValue(null)
      const response = await GET(request())
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Perfil da locadora não encontrado',
      })
      expect(state.transaction).toHaveBeenCalledTimes(1)
      expect(state.tx.clientProfile.findUnique).toHaveBeenCalledTimes(1)
    })
    it.each(['principal', 'transaction', 'profile'] as const)(
      'sanitizes the %s failure inside the existing GET catch',
      async (dependency) => {
        const fail = new Error('fixture-private-detail')
        if (dependency === 'profile')
          state.tx.clientProfile.findUnique.mockRejectedValue(fail)
        else state[dependency].mockRejectedValue(fail)
        const response = await GET(request())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro ao buscar perfil',
        })
        if (dependency === 'principal')
          expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it.each([400, 403, 404] as const)(
      'preserves typed CustomerError status %i',
      async (status) => {
        state.tx.clientProfile.findUnique.mockRejectedValue(
          new CustomerError('fixture-business-error', status)
        )
        const response = await GET(request())
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual({
          error: 'fixture-business-error',
        })
      }
    )
  }
)
