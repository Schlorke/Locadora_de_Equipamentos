import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    notification: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
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
import { GET as legacy } from '@/app/api/client/notifications/route'
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: state.transaction } }),
}))
import { GET as service } from '../../apps/services/api/src/app/api/client/notifications/route'

const principal = {
  userId: 'fixture-user',
  tenantId: 'fixture-tenant',
  membershipId: 'fixture-member',
  role: 'CLIENT' as const,
}
const row = {
  id: 'fixture-notification',
  tenantId: principal.tenantId,
  userId: principal.userId,
  type: 'QUOTE',
  title: 'Private notification',
  message: 'Private message',
  priority: 'HIGH',
  isRead: false,
  actionUrl: '/area-cliente/historico',
  metadata: { amount: '123.45', nested: { source: 'fixture' } },
  createdAt: new Date('2026-01-01T02:03:04.000Z'),
  readAt: null,
}
const scope = { tenantId: principal.tenantId, userId: principal.userId }
const defaultBody = {
  notifications: [{ ...row, createdAt: row.createdAt.toISOString() }],
  pagination: { page: 1, limit: 20, total: 41, totalPages: 3 },
  stats: { total: 41, unread: 7, byType: { quote: 5, system: 2 } },
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  state.principal.mockResolvedValue({ ok: true, principal })
  state.transaction.mockImplementation(async (operation) => operation(state.tx))
  state.tx.notification.findMany.mockResolvedValue([row])
  state.tx.notification.count.mockImplementation(async ({ where }) =>
    where.isRead === false ? 7 : 41
  )
  state.tx.notification.groupBy.mockResolvedValue([
    { type: 'QUOTE', _count: { type: 5 } },
    { type: 'SYSTEM', _count: { type: 2 } },
  ])
})

describe.each([
  ['legacy', legacy],
  ['service', service],
] as const)('%s client notifications GET characterization', (_host, GET) => {
  const request = (query = '') =>
    new NextRequest(
      `https://app.platform.test/api/client/notifications${query}`
    )
  it.each([400, 401, 403, 404, 409, 503])(
    'preserves refusal %i before parsing/transaction',
    async (status) => {
      const denial = Response.json({ error: 'fixture-refused' }, { status })
      state.principal.mockResolvedValue({ ok: false, response: denial })
      expect(await GET(request('?page=invalid'))).toBe(denial)
      expect(state.transaction).not.toHaveBeenCalled()
      expect(state.tx.notification.findMany).not.toHaveBeenCalled()
    }
  )
  it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'])(
    'reads the own inbox for %s with the original projection',
    async (role) => {
      state.principal.mockResolvedValue({
        ok: true,
        principal: { ...principal, role },
      })
      const input = request(
        '?userId=foreign&tenantId=foreign&role=ADMIN&fields=password'
      )
      const response = await GET(input)
      expect(state.principal).toHaveBeenCalledExactlyOnceWith(input)
      expect(state.transaction).toHaveBeenCalledTimes(1)
      expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(principal.tenantId)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBeNull()
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(await response.json()).toEqual(defaultBody)
      expect(state.tx.notification.findMany).toHaveBeenCalledExactlyOnceWith({
        where: scope,
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      })
      expect(state.tx.notification.count.mock.calls).toEqual([
        [{ where: scope }],
        [{ where: { ...scope, isRead: false } }],
      ])
      expect(state.tx.notification.groupBy).toHaveBeenCalledExactlyOnceWith({
        by: ['type'],
        where: { ...scope, isRead: false },
        _count: { type: true },
      })
    }
  )
  it.each([
    ['', 1, 20],
    ['?page=&limit=', 1, 20],
    ['?page=2&limit=1', 2, 1],
    ['?page=100&limit=100', 100, 100],
    ['?page=2abc&limit=3suffix', 2, 3],
    ['?page=2.9&limit=3.5', 2, 3],
    ['?page=1e2&limit=1e2', 1, 1],
    ['?page=%20%2B3%20&limit=%2002%20', 3, 2],
    ['?page=0x10&limit=10', 0, 10],
    ['?page=2&page=4&limit=3&limit=5', 2, 3],
  ] as const)(
    'preserves numeric parsing for %s',
    async (query, page, limit) => {
      const response = await GET(request(query))
      if (page === 0) {
        expect(response.status).toBe(400)
        expect(state.tx.notification.findMany).not.toHaveBeenCalled()
        return
      }
      expect(response.status).toBe(200)
      expect((await response.json()).pagination).toEqual({
        page,
        limit,
        total: 41,
        totalPages: Math.ceil(41 / limit),
      })
      expect(state.tx.notification.findMany).toHaveBeenCalledExactlyOnceWith({
        where: scope,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })
    }
  )
  it.each([
    ['?page=0', 'page', 'too_small'],
    ['?page=-1', 'page', 'too_small'],
    ['?page=abc', 'page', 'invalid_type'],
    ['?page=%20', 'page', 'invalid_type'],
    ['?page=Infinity', 'page', 'invalid_type'],
    ['?limit=0', 'limit', 'too_small'],
    ['?limit=-1', 'limit', 'too_small'],
    ['?limit=101', 'limit', 'too_big'],
    ['?limit=abc', 'limit', 'invalid_type'],
    ['?limit=%20', 'limit', 'invalid_type'],
    ['?type=quote', 'type', 'invalid_value'],
    ['?type=UNKNOWN', 'type', 'invalid_value'],
    ['?type=%20QUOTE', 'type', 'invalid_value'],
    ['?isRead=True', 'isRead', 'invalid_value'],
    ['?isRead=1', 'isRead', 'invalid_value'],
    ['?isRead=false%20', 'isRead', 'invalid_value'],
  ] as const)(
    'validates %s after opening RLS but before any data query',
    async (query, field, code) => {
      const response = await GET(request(query))
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Parâmetros inválidos')
      expect(body.details).toHaveLength(1)
      expect(body.details[0]).toMatchObject({ path: [field], code })
      expect(body.details[0].message).toEqual(expect.any(String))
      expect(state.transaction).toHaveBeenCalledTimes(1)
      expect(state.tx.$queryRaw).toHaveBeenCalledTimes(1)
      expect(state.tx.notification.findMany).not.toHaveBeenCalled()
      expect(state.tx.notification.count).not.toHaveBeenCalled()
      expect(state.tx.notification.groupBy).not.toHaveBeenCalled()
    }
  )
  it.each([
    'QUOTE',
    'ORDER',
    'PAYMENT',
    'EQUIPMENT',
    'SYSTEM',
    'RENTAL',
    'DELIVERY',
    'CONTRACT',
  ])('filters %s while stats retain all unread types', async (type) => {
    const response = await GET(
      request(`?type=${type}&isRead=true&page=2&limit=3`)
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.stats).toEqual(defaultBody.stats)
    expect(state.tx.notification.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { ...scope, type, isRead: true },
      orderBy: { createdAt: 'desc' },
      skip: 3,
      take: 3,
    })
    expect(state.tx.notification.count.mock.calls).toEqual([
      [{ where: { ...scope, type, isRead: true } }],
      [{ where: { ...scope, isRead: false } }],
    ])
    expect(state.tx.notification.groupBy).toHaveBeenCalledExactlyOnceWith({
      by: ['type'],
      where: { ...scope, isRead: false },
      _count: { type: true },
    })
  })
  it.each([
    ['?type=&isRead=', undefined],
    ['?isRead=true', true],
    ['?isRead=false', false],
    ['?type=&type=QUOTE&isRead=&isRead=true', undefined],
  ] as const)(
    'preserves empty/boolean/first query semantics: %s',
    async (query, isRead) => {
      const response = await GET(request(query))
      expect(response.status).toBe(200)
      expect(state.tx.notification.findMany.mock.calls[0]![0].where).toEqual({
        ...scope,
        ...(isRead === undefined ? {} : { isRead }),
      })
    }
  )
  it('keeps zero totalPages and independent empty statistics', async () => {
    state.tx.notification.findMany.mockResolvedValue([])
    state.tx.notification.count.mockResolvedValue(0)
    state.tx.notification.groupBy.mockResolvedValue([])
    expect(await (await GET(request('?page=9'))).json()).toEqual({
      notifications: [],
      pagination: { page: 9, limit: 20, total: 0, totalPages: 0 },
      stats: { total: 0, unread: 0, byType: {} },
    })
  })
  it('starts the list and filtered count together before unread statistics', async () => {
    let finish!: (_value: unknown[]) => void
    state.tx.notification.findMany.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = GET(request('?type=QUOTE'))
    await vi.waitFor(() =>
      expect(state.tx.notification.count).toHaveBeenCalledTimes(1)
    )
    expect(state.tx.notification.groupBy).not.toHaveBeenCalled()
    finish([row])
    expect((await pending).status).toBe(200)
    expect(state.tx.notification.count).toHaveBeenCalledTimes(2)
  })
  it.each([
    'principal',
    'transaction',
    'rls',
    'findMany',
    'count',
    'groupBy',
  ] as const)(
    'sanitizes a %s failure with the original log and envelope',
    async (dependency) => {
      const error = new Error('fixture-private-database-error')
      if (dependency === 'principal' || dependency === 'transaction')
        state[dependency].mockRejectedValue(error)
      else if (dependency === 'rls') state.tx.$queryRaw.mockRejectedValue(error)
      else state.tx.notification[dependency].mockRejectedValue(error)
      const response = await GET(request('?page=invalid'))
      if (
        dependency === 'findMany' ||
        dependency === 'count' ||
        dependency === 'groupBy'
      ) {
        expect(response.status).toBe(400)
        expect(console.error).not.toHaveBeenCalled()
        const valid = await GET(request())
        expect(valid.status).toBe(500)
        expect(await valid.json()).toEqual({
          error: 'Erro interno do servidor',
        })
      } else {
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro interno do servidor',
        })
      }
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        'Client portal operation failed'
      )
    }
  )
})
