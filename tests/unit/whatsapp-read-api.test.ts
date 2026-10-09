import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  context: vi.fn(),
  send: vi.fn(),
  conversations: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  messages: { findMany: vi.fn() },
}))
vi.mock('@/middlewares/require-admin', () => ({
  requireAdminOrOperator: mocks.gate,
}))
vi.mock('@/lib/meta-whatsapp', () => ({ sendTextMessage: mocks.send }))
vi.mock('@/lib/tenant', () => ({
  withTenantTransaction: async (
    scope: unknown,
    operation: (_tx: unknown) => Promise<unknown>
  ) => {
    mocks.context(scope)
    return operation({
      whatsAppConversation: mocks.conversations,
      whatsAppMessage: mocks.messages,
    })
  },
}))
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock(
  '../../apps/services/api/src/host/private-identity',
  async (importOriginal) => {
    const legacy = (await (() => ({
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
    const F = await (() => ({ sendTextMessage: mocks.send }))()
    return { createWhatsAppClient: () => F }
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
        scope: unknown,
        operation: (_tx: unknown) => Promise<unknown>
      ) => {
        mocks.context(scope)
        return operation({
          whatsAppConversation: mocks.conversations,
          whatsAppMessage: mocks.messages,
        })
      },
    }))()),
  })
)
import * as legacyRoute0 from '@/app/api/admin/whatsapp/conversations/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/whatsapp/conversations/route'
import * as legacyRoute1 from '@/app/api/admin/whatsapp/conversations/[conversationId]/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/whatsapp/conversations/[conversationId]/route'
import * as legacyRoute2 from '@/app/api/admin/whatsapp/conversations/[conversationId]/messages/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/whatsapp/conversations/[conversationId]/messages/route'

const HOSTS = [
  [
    'legacy root',
    {
      list: legacyRoute0.GET,
      detail: legacyRoute1.GET,
      messages: legacyRoute2.GET,
    },
  ],
  [
    'service',
    {
      list: serviceRoute0.GET,
      detail: serviceRoute1.GET,
      messages: serviceRoute2.GET,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { list, detail, messages }) => {
  const principal = {
    tenantId: 'tenant-alfa',
    userId: 'user-a',
    membershipId: 'member-a',
    role: 'OPERATOR',
  }
  const date = new Date('2026-10-02T14:00:00.123Z')
  const conversation = {
    id: 'conversation-a',
    tenantId: principal.tenantId,
    phone: '551100000001',
    displayName: 'Ana',
    lastMessageAt: date,
    createdAt: date,
    updatedAt: date,
    _count: { messages: 3 },
  }
  const conversationDto = {
    id: conversation.id,
    phone: conversation.phone,
    displayName: 'Ana',
    lastMessageAt: date.toISOString(),
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
    messageCount: 3,
  }
  const row = (id: string, timestamp: string) => ({
    id,
    tenantId: principal.tenantId,
    conversationId: conversation.id,
    providerMessageId: 'provider-' + id,
    direction: 'INBOUND',
    type: 'TEXT',
    body: 'Texto ' + id,
    mediaUrl: null,
    timestamp: new Date(timestamp),
    status: null,
    createdAt: date,
  })
  const request = (query = '') =>
    new NextRequest(
      'https://api.example.test/api/admin/whatsapp/conversations?' + query
    )
  const params = (conversationId = conversation.id) => ({
    params: Promise.resolve({ conversationId }),
  })
  const routes = [
    ['list', () => list(request())],
    ['detail', () => detail(request(), params())],
    ['messages', () => messages(request(), params())],
  ] as const
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.gate.mockResolvedValue({
      success: true,
      principal,
      tenantId: principal.tenantId,
      user: { id: principal.userId },
    })
    mocks.conversations.findMany.mockResolvedValue([conversation])
    mocks.conversations.findFirst.mockResolvedValue(conversation)
    mocks.conversations.count.mockResolvedValue(1)
    mocks.messages.findMany.mockResolvedValue([
      row('new', '2026-10-02T14:00:02Z'),
      row('old', '2026-10-02T14:00:01Z'),
    ])
  })
  describe('WhatsApp read legacy characterization', () => {
    it.each(routes)('%s denies before SQL or provider', async (_name, run) => {
      mocks.gate.mockResolvedValue({
        success: false,
        error: 'Acesso negado',
        status: 403,
      })
      const r = await run()
      expect(r.status).toBe(403)
      expect(await r.json()).toEqual({ error: 'Acesso negado' })
      expect(mocks.context).not.toHaveBeenCalled()
      expect(mocks.send).not.toHaveBeenCalled()
    })
    it('lists scoped metadata and count in one transaction, without extra columns', async () => {
      const r = await list(request())
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({
        conversations: [conversationDto],
        total: 1,
      })
      expect(mocks.conversations.findMany).toHaveBeenCalledWith({
        where: { tenantId: principal.tenantId },
        orderBy: { lastMessageAt: 'desc' },
        take: 50,
        skip: 0,
        include: { _count: { select: { messages: true } } },
      })
      expect(mocks.conversations.count).toHaveBeenCalledWith({
        where: { tenantId: principal.tenantId },
      })
      expect(mocks.context).toHaveBeenCalledExactlyOnceWith(principal)
    })
    it.each([
      ['limit=-7&offset=-9', 1, 0],
      ['limit=999&offset=7', 100, 7],
      ['limit=0&offset=0', 50, 0],
      ['limit=2.5&offset=1.5', 2.5, 1.5],
      ['limit=bad&offset=bad', 50, 0],
      ['limit=Infinity&offset=Infinity', 100, Infinity],
    ])('keeps list coercion %s', async (query, take, skip) => {
      await list(request(query))
      expect(mocks.conversations.findMany.mock.calls[0]![0]).toMatchObject({
        take,
        skip,
      })
    })
    it('trims search and scopes both case-insensitive fields and count', async () => {
      await list(request('search=%20Ana%20'))
      const where = {
        tenantId: principal.tenantId,
        OR: [
          { phone: { contains: 'Ana', mode: 'insensitive' } },
          { displayName: { contains: 'Ana', mode: 'insensitive' } },
        ],
      }
      expect(mocks.conversations.findMany.mock.calls[0]![0].where).toEqual(
        where
      )
      expect(mocks.conversations.count).toHaveBeenCalledWith({ where })
    })
    it('blank search does not add a filter and an empty list keeps the envelope', async () => {
      mocks.conversations.findMany.mockResolvedValue([])
      mocks.conversations.count.mockResolvedValue(0)
      const r = await list(request('search=%20%20'))
      expect(await r.json()).toEqual({ conversations: [], total: 0 })
      expect(mocks.conversations.findMany.mock.calls[0]![0].where).toEqual({
        tenantId: principal.tenantId,
      })
    })
    it.each([
      ['detail', detail],
      ['messages', messages],
    ] as const)('%s requires id before SQL', async (_name, run) => {
      const r = await run(request(), params(''))
      expect(r.status).toBe(400)
      expect(await r.json()).toEqual({ error: 'conversationId é obrigatório' })
      expect(mocks.context).not.toHaveBeenCalled()
    })
    it('reads detail by id plus tenant and returns only the original DTO', async () => {
      const r = await detail(request(), params())
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual(conversationDto)
      expect(mocks.conversations.findFirst).toHaveBeenCalledWith({
        where: { id: conversation.id, tenantId: principal.tenantId },
        include: { _count: { select: { messages: true } } },
      })
    })
    it.each([
      ['detail', detail],
      ['messages', messages],
    ] as const)(
      '%s keeps neutral missing/foreign 404 before message query',
      async (_name, run) => {
        mocks.conversations.findFirst.mockResolvedValue(null)
        const r = await run(request(), params('foreign'))
        expect(r.status).toBe(404)
        expect(await r.json()).toEqual({ error: 'Conversa não encontrada' })
        expect(mocks.conversations.findFirst.mock.calls[0]![0].where).toEqual({
          id: 'foreign',
          tenantId: principal.tenantId,
        })
        expect(mocks.messages.findMany).not.toHaveBeenCalled()
      }
    )
    it('returns each descending page in chronological order with exact message fields', async () => {
      const r = await messages(request(), params())
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({
        messages: [
          {
            ...row('old', '2026-10-02T14:00:01Z'),
            tenantId: undefined,
            timestamp: '2026-10-02T14:00:01.000Z',
            createdAt: date.toISOString(),
          },
          {
            ...row('new', '2026-10-02T14:00:02Z'),
            tenantId: undefined,
            timestamp: '2026-10-02T14:00:02.000Z',
            createdAt: date.toISOString(),
          },
        ].map(({ tenantId: _scope, ...dto }) => dto),
      })
      expect(mocks.conversations.findFirst).toHaveBeenCalledWith({
        where: { id: conversation.id, tenantId: principal.tenantId },
      })
      expect(mocks.messages.findMany).toHaveBeenCalledWith({
        where: {
          conversationId: conversation.id,
          tenantId: principal.tenantId,
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
      })
      expect(mocks.context.mock.calls).toEqual([[principal], [principal]])
    })
    it.each([
      ['limit=0', 50],
      ['limit=-4', -4],
      ['limit=999', 100],
      ['limit=2.5', 2.5],
      ['limit=bad', 50],
    ])('keeps message limit coercion %s', async (query, take) => {
      await messages(request(query), params())
      expect(mocks.messages.findMany.mock.calls[0]![0].take).toBe(take)
    })
    it('applies a strict before timestamp after ownership', async () => {
      await messages(request('before=2026-10-02T14%3A00%3A02Z'), params())
      expect(mocks.messages.findMany.mock.calls[0]![0].where).toEqual({
        conversationId: conversation.id,
        tenantId: principal.tenantId,
        timestamp: { lt: new Date('2026-10-02T14:00:02Z') },
      })
      expect(
        mocks.conversations.findFirst.mock.invocationCallOrder[0]
      ).toBeLessThan(mocks.messages.findMany.mock.invocationCallOrder[0]!)
    })
    it.each(['before=bad', 'before='])(
      'ignores invalid/empty cursor %s',
      async (query) => {
        await messages(request(query), params())
        expect(mocks.messages.findMany.mock.calls[0]![0].where).toEqual({
          conversationId: conversation.id,
          tenantId: principal.tenantId,
        })
      }
    )
    it('keeps nullable fields and empty messages', async () => {
      mocks.conversations.findFirst.mockResolvedValue({
        ...conversation,
        displayName: null,
      })
      expect(await (await detail(request(), params())).json()).toEqual({
        ...conversationDto,
        displayName: null,
      })
      mocks.messages.findMany.mockResolvedValue([])
      expect(await (await messages(request(), params())).json()).toEqual({
        messages: [],
      })
    })
    it.each(routes)(
      '%s keeps Error.message and a safe fallback for non-Errors',
      async (name, run) => {
        for (const failure of [
          new Error('local-query-failure'),
          'untyped failure',
        ]) {
          const lookup =
            name === 'list'
              ? mocks.conversations.findMany
              : mocks.conversations.findFirst
          lookup.mockRejectedValueOnce(failure)
          const r = await run()
          expect(r.status).toBe(500)
          expect(await r.json()).toEqual({
            error:
              failure instanceof Error
                ? failure.message
                : name === 'list'
                  ? 'Erro ao listar conversas'
                  : name === 'detail'
                    ? 'Erro ao buscar conversa'
                    : 'Erro ao listar mensagens',
          })
        }
        expect(mocks.send).not.toHaveBeenCalled()
      }
    )
  })
})
