import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    notification: { count: vi.fn(), groupBy: vi.fn() },
  },
}))
vi.mock('@/lib/tenant', async () => {
  const { withTenantTransaction } =
    await import('@gb-locacoes/backend/identity')
  return {
    resolveTenantPrincipal: state.principal,
    withTenantTransaction: (context: { tenantId: string }, operation: never) =>
      withTenantTransaction(
        { $transaction: state.transaction } as never,
        context,
        operation
      ),
  }
})
import { GET as legacy } from '@/app/api/client/notifications/stats/route'
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: state.transaction } }),
}))
import { GET as service } from '../../apps/services/api/src/app/api/client/notifications/stats/route'

const principal = {
  userId: 'fixture-recipient',
  tenantId: 'fixture-tenant',
  membershipId: 'fixture-membership',
  role: 'CLIENT' as const,
}
const scope = { tenantId: principal.tenantId, userId: principal.userId }
const body = {
  total: 17,
  unread: 9,
  byType: { quote: 5, system: 4 },
  byPriority: { high: 6, low: 3 },
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  state.principal.mockResolvedValue({ ok: true, principal })
  state.transaction.mockImplementation(async (operation) => operation(state.tx))
  state.tx.notification.count.mockImplementation(async ({ where }) =>
    where.isRead === false ? 9 : 17
  )
  state.tx.notification.groupBy.mockImplementation(async ({ by }) =>
    by[0] === 'type'
      ? [
          { type: 'QUOTE', _count: { type: 5 } },
          { type: 'SYSTEM', _count: { type: 4 } },
        ]
      : [
          { priority: 'HIGH', _count: { priority: 6 } },
          { priority: 'LOW', _count: { priority: 3 } },
        ]
  )
})

describe.each([
  ['legacy', legacy],
  ['service', service],
] as const)(
  '%s client notification stats GET characterization',
  (_host, GET) => {
    const request = (query = '') =>
      new Request(
        `https://app.platform.test/api/client/notifications/stats${query}`
      )
    it.each([400, 401, 403, 404, 409, 503])(
      'preserves refusal %i before opening RLS or reading data',
      async (status) => {
        const denial = Response.json({ error: 'fixture-refused' }, { status })
        state.principal.mockResolvedValue({ ok: false, response: denial })
        expect(await GET(request('?type=invalid'))).toBe(denial)
        expect(state.transaction).not.toHaveBeenCalled()
        expect(state.tx.notification.count).not.toHaveBeenCalled()
        expect(state.tx.notification.groupBy).not.toHaveBeenCalled()
      }
    )
    it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'])(
      'scopes all four reads to the own recipient for membership %s',
      async (role) => {
        state.principal.mockResolvedValue({
          ok: true,
          principal: { ...principal, role },
        })
        const input = request('?tenantId=foreign&userId=foreign&role=ADMIN')
        const response = await GET(input)
        expect(state.principal).toHaveBeenCalledExactlyOnceWith(input)
        expect(state.transaction).toHaveBeenCalledTimes(1)
        expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(principal.tenantId)
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(body)
        expect(response.headers.get('cache-control')).toBeNull()
        expect(response.headers.get('set-cookie')).toBeNull()
        expect(state.tx.notification.count.mock.calls).toEqual([
          [{ where: scope }],
          [{ where: { ...scope, isRead: false } }],
        ])
        expect(state.tx.notification.groupBy.mock.calls).toEqual([
          [
            {
              by: ['type'],
              where: { ...scope, isRead: false },
              _count: { type: true },
            },
          ],
          [
            {
              by: ['priority'],
              where: { ...scope, isRead: false },
              _count: { priority: true },
            },
          ],
        ])
      }
    )
    it.each([
      '',
      '?page=invalid&limit=-1',
      '?type=QUOTE&isRead=true&priority=LOW',
      '?type=invalid&type=QUOTE&isRead=invalid',
      '?tenantId=foreign&userId=foreign&fields=password',
    ])('ignores list filters and arbitrary query keys: %s', async (query) => {
      const response = await GET(request(query))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(body)
    })
    it('returns zero counts and empty maps for an empty inbox', async () => {
      state.tx.notification.count.mockResolvedValue(0)
      state.tx.notification.groupBy.mockResolvedValue([])
      expect(await (await GET(request())).json()).toEqual({
        total: 0,
        unread: 0,
        byType: {},
        byPriority: {},
      })
    })
    it('keeps total when every notification is read, without zero-filled buckets', async () => {
      state.tx.notification.count.mockImplementation(async ({ where }) =>
        where.isRead === false ? 0 : 17
      )
      state.tx.notification.groupBy.mockResolvedValue([])
      expect(await (await GET(request())).json()).toEqual({
        total: 17,
        unread: 0,
        byType: {},
        byPriority: {},
      })
    })
    it('serializes every type and priority in lowercase', async () => {
      state.tx.notification.count.mockImplementation(async ({ where }) =>
        where.isRead === false ? 8 : 17
      )
      state.tx.notification.groupBy.mockImplementation(async ({ by }) =>
        by[0] === 'type'
          ? [
              'QUOTE',
              'ORDER',
              'PAYMENT',
              'EQUIPMENT',
              'SYSTEM',
              'RENTAL',
              'DELIVERY',
              'CONTRACT',
            ].map((type) => ({ type, _count: { type: 1 } }))
          : [
              { priority: 'HIGH', _count: { priority: 3 } },
              { priority: 'MEDIUM', _count: { priority: 3 } },
              { priority: 'LOW', _count: { priority: 2 } },
            ]
      )
      expect(await (await GET(request())).json()).toEqual({
        total: 17,
        unread: 8,
        byType: {
          quote: 1,
          order: 1,
          payment: 1,
          equipment: 1,
          system: 1,
          rental: 1,
          delivery: 1,
          contract: 1,
        },
        byPriority: { high: 3, medium: 3, low: 2 },
      })
    })
    it('starts all four aggregates before waiting for any result', async () => {
      const resolvers: Array<() => void> = []
      state.tx.notification.count.mockImplementation(
        () => new Promise((resolve) => resolvers.push(() => resolve(0)))
      )
      state.tx.notification.groupBy.mockImplementation(
        () => new Promise((resolve) => resolvers.push(() => resolve([])))
      )
      const pending = GET(request())
      await vi.waitFor(() => expect(resolvers).toHaveLength(4))
      for (const resolve of resolvers) resolve()
      expect(await (await pending).json()).toEqual({
        total: 0,
        unread: 0,
        byType: {},
        byPriority: {},
      })
    })
    it.each([
      'principal',
      'transaction',
      'rls',
      'total',
      'unread',
      'type',
      'priority',
    ])('sanitizes failure at %s without leaking internals', async (step) => {
      const failure = new Error('fixture-private-connection-and-query')
      if (step === 'principal') state.principal.mockRejectedValue(failure)
      if (step === 'transaction') state.transaction.mockRejectedValue(failure)
      if (step === 'rls') state.tx.$queryRaw.mockRejectedValue(failure)
      if (step === 'total')
        state.tx.notification.count.mockRejectedValueOnce(failure)
      if (step === 'unread')
        state.tx.notification.count
          .mockResolvedValueOnce(17)
          .mockRejectedValueOnce(failure)
      if (step === 'type')
        state.tx.notification.groupBy.mockRejectedValueOnce(failure)
      if (step === 'priority')
        state.tx.notification.groupBy
          .mockResolvedValueOnce([])
          .mockRejectedValueOnce(failure)
      const response = await GET(request())
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro interno do servidor',
      })
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        'Client portal operation failed'
      )
      if (step === 'rls') {
        expect(state.tx.notification.count).not.toHaveBeenCalled()
        expect(state.tx.notification.groupBy).not.toHaveBeenCalled()
      }
    })
  }
)
