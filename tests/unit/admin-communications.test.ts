import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  tx: {
    quote: { count: vi.fn(), findMany: vi.fn() },
    rentals: { count: vi.fn(), findMany: vi.fn() },
    whatsAppConversation: { findMany: vi.fn() },
    membership: { findMany: vi.fn() },
    notification: { findMany: vi.fn(), createMany: vi.fn() },
    $executeRaw: vi.fn(),
  },
  configured: vi.fn(),
  token: vi.fn(),
  account: vi.fn(),
  mail: vi.fn(),
}))
vi.mock('@/lib/tenant', () => ({
  withTenantTransaction: async (
    _context: unknown,
    operation: (_tx: unknown) => Promise<unknown>
  ) => operation(mocks.tx),
}))
vi.mock('@/middlewares/require-admin', () => ({
  requireAdmin: mocks.gate,
  requireAdminOrOperator: mocks.gate,
}))
vi.mock('@/lib/zoho-mail', () => ({
  isZohoOAuthConfigured: mocks.configured,
  getZohoAccessToken: mocks.token,
  getZohoAccountId: mocks.account,
  makeZohoMailRequest: mocks.mail,
}))

import { createAdminNotifications } from '@/lib/notification-service'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock(
  '../../apps/services/api/src/host/private-identity',
  async (importOriginal) => {
    const legacy = (await (() => ({
      requireAdmin: mocks.gate,
      requireAdminOrOperator: mocks.gate,
    }))()) as Record<
      string,
      (
        request?: unknown
      ) => Promise<{
        success: boolean
        principal?: unknown
        error?: string
        status?: number
      }>
    >
    const gate =
      legacy.requireAdminOrOperator ??
      legacy.requireAdmin ??
      Object.values(legacy)[0]!
    const adapt = async (request?: unknown) => {
      const result = await gate(request)
      return result.success
        ? { ok: true as const, principal: result.principal }
        : {
            ok: false as const,
            response: Response.json(
              { error: result.error },
              { status: result.status }
            ),
          }
    }
    return {
      ...(await importOriginal<Record<string, unknown>>()),
      resolveTenantPrincipal: adapt,
    }
  }
)
vi.mock(
  '../../apps/services/api/src/host/permissions',
  async (importOriginal) => {
    const legacy = (await (() => ({
      requireAdmin: mocks.gate,
      requireAdminOrOperator: mocks.gate,
    }))()) as Record<
      string,
      (
        request?: unknown
      ) => Promise<{
        success: boolean
        principal?: unknown
        error?: string
        status?: number
      }>
    >
    const gate =
      legacy.requireAdminOrOperator ??
      legacy.requireAdmin ??
      Object.values(legacy)[0]!
    const adapt = async (request?: unknown) => {
      const result = await gate(request)
      return result.success
        ? { ok: true as const, principal: result.principal }
        : {
            ok: false as const,
            response: Response.json(
              { error: result.error },
              { status: result.status }
            ),
          }
    }
    return {
      ...(await importOriginal<Record<string, unknown>>()),
      requireTenantPermission: adapt,
    }
  }
)
vi.mock('@gb-locacoes/backend/communications', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@gb-locacoes/backend/communications')
  >()),
  ...(await (async () => {
    const F = await (() => ({
      isZohoOAuthConfigured: mocks.configured,
      getZohoAccessToken: mocks.token,
      getZohoAccountId: mocks.account,
      makeZohoMailRequest: mocks.mail,
    }))()
    return { createZohoMailClient: () => F, createZohoMailTokenReader: () => F }
  })()),
}))
vi.mock(
  '../../apps/services/api/src/host/tenant-transaction',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/tenant-transaction')
    >()),
    ...(await (() => ({
      withTenantTransaction: async (
        _context: unknown,
        operation: (_tx: unknown) => Promise<unknown>
      ) => operation(mocks.tx),
    }))()),
  })
)
import * as legacyRoute0 from '@/app/api/admin/badges/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/badges/route'
import * as legacyRoute1 from '@/app/api/admin/notifications/sync/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/notifications/sync/route'

const HOSTS = [
  [
    'legacy root',
    {
      GET: legacyRoute0.GET,
      POST: legacyRoute1.POST,
    },
  ],
  [
    'service',
    {
      GET: serviceRoute0.GET,
      POST: serviceRoute1.POST,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { GET, POST }) => {
  const context = { tenantId: 'alfa' }
  const now = new Date('2026-10-02T12:00:00Z')
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000)
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(now)
    mocks.gate.mockResolvedValue({
      success: true,
      principal: { ...context, userId: 'admin', role: 'ADMIN' },
      tenantId: 'alfa',
      user: { id: 'admin' },
    })
    mocks.tx.quote.count.mockResolvedValue(4)
    mocks.tx.rentals.count.mockResolvedValue(2)
    mocks.tx.quote.findMany.mockResolvedValue([])
    mocks.tx.rentals.findMany.mockResolvedValue([])
    mocks.tx.whatsAppConversation.findMany.mockResolvedValue([])
    mocks.tx.membership.findMany.mockResolvedValue([{ userId: 'admin' }])
    mocks.tx.notification.findMany.mockResolvedValue([])
    mocks.tx.notification.createMany.mockImplementation(async ({ data }) => ({
      count: data.length,
    }))
    mocks.configured.mockReturnValue(false)
    mocks.token.mockResolvedValue('local-token')
    mocks.account.mockResolvedValue('local-account')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.useRealTimers())

  describe('legacy admin communications characterization', () => {
    it.each([GET, POST])(
      'refuses before SQL or provider calls',
      async (handler) => {
        mocks.gate.mockResolvedValue({
          success: false,
          error: 'Acesso negado',
          status: 403,
        })
        const response = await handler()
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'Acesso negado' })
        expect(mocks.tx.quote.count).not.toHaveBeenCalled()
        expect(mocks.tx.membership.findMany).not.toHaveBeenCalled()
        expect(mocks.token).not.toHaveBeenCalled()
      }
    )

    it('counts pending quotes, linked rentals and conversations whose last message is inbound', async () => {
      mocks.tx.whatsAppConversation.findMany.mockResolvedValue([
        { messages: [{ direction: 'INBOUND' }] },
        { messages: [{ direction: 'OUTBOUND' }] },
        { messages: [] },
      ])
      const response = await GET()
      expect(await response.json()).toEqual({
        email: 0,
        quotes: 4,
        rentals: 2,
        whatsapp: 1,
      })
      expect(mocks.tx.quote.count).toHaveBeenCalledWith({
        where: { tenantId: 'alfa', status: 'PENDING' },
      })
      expect(mocks.tx.rentals.count).toHaveBeenCalledWith({
        where: {
          tenantId: 'alfa',
          status: { in: ['PENDING', 'PENDING_RETURN'] },
          quoteId: { not: null },
        },
      })
      expect(
        mocks.tx.whatsAppConversation.findMany.mock.calls[0]![0]
      ).toMatchObject({
        where: { tenantId: 'alfa' },
        select: { messages: { orderBy: { timestamp: 'desc' }, take: 1 } },
      })
      expect(mocks.token).not.toHaveBeenCalled()
    })
    it('WhatsApp failure is zero while quote failure remains a generic 500', async () => {
      mocks.tx.whatsAppConversation.findMany.mockRejectedValue(
        new Error('private SQL')
      )
      expect(await (await GET()).json()).toEqual({
        email: 0,
        quotes: 4,
        rentals: 2,
        whatsapp: 0,
      })
      mocks.tx.quote.count.mockRejectedValue(new Error('private SQL'))
      const response = await GET()
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao obter contagens',
      })
    })
    it.each([
      { data: [{ folderType: '1', unreadCount: 7 }] },
      { folders: [{ folderName: 'INBOX', unreadCount: 7 }] },
      { data: [{ folderName: 'Caixa de entrada', unreadCount: 7 }] },
    ])('accepts existing provider folder envelopes %j', async (raw) => {
      mocks.configured.mockReturnValue(true)
      mocks.mail.mockResolvedValue(raw)
      expect((await (await GET()).json()).email).toBe(7)
      expect(mocks.mail).toHaveBeenCalledWith(
        'local-token',
        '/accounts/local-account/folders',
        { signal: expect.any(AbortSignal) }
      )
      expect(vi.getTimerCount()).toBe(0)
    })
    it('aborts folders after five seconds and clears the timer on failure', async () => {
      mocks.configured.mockReturnValue(true)
      mocks.mail.mockImplementation(
        (_token, _path, { signal }) =>
          new Promise((_resolve, reject) =>
            signal.addEventListener('abort', () => reject(new Error('aborted')))
          )
      )
      const response = GET()
      await vi.advanceTimersByTimeAsync(4999)
      expect(mocks.mail.mock.calls[0]![2].signal.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect((await (await response).json()).email).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
    })
    it.each(['token', 'account', 'provider'])(
      'degrades unavailable %s to zero',
      async (kind) => {
        mocks.configured.mockReturnValue(true)
        if (kind === 'token') mocks.token.mockResolvedValue(null)
        if (kind === 'account') mocks.account.mockResolvedValue(null)
        if (kind === 'provider')
          mocks.mail.mockRejectedValue(new Error('private provider'))
        expect((await (await GET()).json()).email).toBe(0)
        expect(vi.getTimerCount()).toBe(0)
      }
    )
    it('returns zero without administrators before examining resources', async () => {
      mocks.tx.membership.findMany.mockResolvedValue([])
      expect(await (await POST()).json()).toEqual({
        success: true,
        results: { created: 0, checks: 0 },
      })
      expect(mocks.tx.quote.findMany).not.toHaveBeenCalled()
    })
    it('preserves the nine alert keys, exact cutoffs, metadata and six-hour coalescence', async () => {
      mocks.tx.quote.findMany
        .mockResolvedValueOnce([{ id: 'pending' }])
        .mockResolvedValueOnce([
          { id: 'missing', cpf: 'fixture', approvedAt: ago(2), payments: [] },
          {
            id: 'unsent',
            cnpj: 'fixture',
            approvedAt: ago(2),
            payments: [{ id: 'p1', metadata: [] }],
          },
          {
            id: 'unpaid',
            cpf: 'fixture',
            approvedAt: ago(3),
            payments: [
              {
                id: 'p2',
                status: 'OVERDUE',
                metadata: { boletoSentAt: ago(24).toISOString() },
              },
            ],
          },
          { id: 'nodoc', approvedAt: ago(4), payments: [] },
          { id: 'fresh', cpf: 'fixture', approvedAt: ago(1), payments: [] },
          {
            id: 'paid',
            cpf: 'fixture',
            approvedAt: ago(3),
            payments: [
              {
                id: 'p3',
                status: 'PAID',
                metadata: { boletoSentAt: ago(24).toISOString() },
              },
            ],
          },
        ])
        .mockResolvedValueOnce([
          { id: 'approved', updatedAt: ago(4) },
          { id: 'fresh', updatedAt: ago(3) },
        ])
      mocks.tx.rentals.findMany
        .mockResolvedValueOnce([{ id: 'checkin' }])
        .mockResolvedValueOnce([{ id: 'return' }])
        .mockResolvedValueOnce([{ id: 'overdue' }])
        .mockResolvedValueOnce([{ id: 'overdue' }])
        .mockResolvedValueOnce([{ id: 'contract' }])
      const response = await POST()
      expect(await response.json()).toEqual({
        success: true,
        results: { created: 9, checks: 9 },
      })
      const data = mocks.tx.notification.createMany.mock.calls.map(
        ([input]) => input.data[0]
      )
      expect(data.map((row) => row.metadata.dedupeKey)).toEqual([
        'admin:sync:quote_pending',
        'admin:sync:boleto_not_generated',
        'admin:sync:boleto_not_sent',
        'admin:sync:payment_pending',
        'admin:sync:approved_no_rental',
        'admin:sync:checkin_pending',
        'admin:sync:return_pending',
        'admin:sync:rental_overdue',
        'admin:sync:contract_pending',
      ])
      expect(mocks.tx.quote.findMany.mock.calls[0]![0].where).toEqual({
        tenantId: 'alfa',
        status: 'PENDING',
        approvedAt: null,
        rejectedAt: null,
        clientDeletedAt: null,
        createdAt: { lte: ago(4) },
      })
      expect(mocks.tx.quote.findMany.mock.calls[1]![0]).toMatchObject({
        where: {
          tenantId: 'alfa',
          status: 'PENDING',
          approvedAt: { not: null },
          rejectedAt: null,
        },
        select: {
          payments: {
            where: { tenantId: 'alfa', method: 'BOLETO' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })
      expect(
        mocks.tx.rentals.findMany.mock.calls[0]![0].where.startdate
      ).toEqual({ lte: ago(2) })
      expect(mocks.tx.rentals.findMany.mock.calls[1]![0].where.enddate).toEqual(
        {
          lte: ago(2),
        }
      )
      expect(
        mocks.tx.rentals.findMany.mock.calls[4]![0].where.checkInAt
      ).toEqual({ not: null, lte: ago(4) })
    })
    it('fanout revalidates supplied recipients, ignores read state and serializes by tenant', async () => {
      mocks.tx.membership.findMany.mockResolvedValue([
        { userId: 'admin' },
        { userId: 'other-admin' },
      ])
      mocks.tx.notification.findMany.mockResolvedValue([{ userId: 'admin' }])
      const result = await createAdminNotifications(context, {
        type: 'SYSTEM',
        title: 'Title',
        message: 'Message',
        adminIds: ['admin', 'other-admin', 'foreign'],
        dedupeKey: 'key',
      })
      expect(result).toEqual({ count: 1 })
      expect(mocks.tx.membership.findMany.mock.calls[0]![0].where).toEqual({
        tenantId: 'alfa',
        role: 'ADMIN',
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
        userId: { in: ['admin', 'other-admin', 'foreign'] },
      })
      expect(mocks.tx.notification.findMany.mock.calls[0]![0].where).toEqual({
        tenantId: 'alfa',
        userId: { in: ['admin', 'other-admin'] },
        type: 'SYSTEM',
        createdAt: { gte: ago(6) },
        metadata: { path: ['dedupeKey'], equals: 'key' },
      })
      expect(mocks.tx.$executeRaw).toHaveBeenCalledOnce()
      expect(mocks.tx.$executeRaw.mock.calls[0]![1]).toBe(
        'alfa:admin-notifications'
      )
      expect(mocks.tx.notification.createMany.mock.calls[0]![0].data).toEqual([
        {
          userId: 'other-admin',
          tenantId: 'alfa',
          type: 'SYSTEM',
          title: 'Title',
          message: 'Message',
          priority: 'MEDIUM',
          actionUrl: undefined,
          metadata: { dedupeKey: 'key' },
        },
      ])
    })
  })
})
