import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SubscriptionCommandError } from '../../packages/backend/src/modules/entitlements/command-admission'
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  principal: vi.fn(),
  send: vi.fn(),
  context: vi.fn(),
  conversation: vi.fn(),
  message: vi.fn(),
}))
vi.mock('@/middlewares/require-admin', () => ({
  requireAdminOrOperator: mocks.admin,
}))
vi.mock('@/lib/tenant', () => ({
  resolveTenantPrincipal: mocks.principal,
  withTenantTransaction: async (
    scope: unknown,
    operation: (_tx: unknown) => unknown
  ) => {
    mocks.context(scope)
    return operation({
      whatsAppConversation: { findFirst: mocks.conversation },
      whatsAppMessage: { findFirst: mocks.message },
    })
  },
}))
vi.mock('@/lib/meta-whatsapp', () => ({ sendTextMessage: mocks.send }))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: mocks.principal,
}))
vi.mock('../../apps/services/api/src/host/whatsapp-read', () => ({
  readMessages: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/whatsapp-write', async () => {
  const { createWhatsAppSendHandlers } =
    await import('@gb-locacoes/backend/http')
  return createWhatsAppSendHandlers({
    sendTextMessage: mocks.send,
    withTenantTransaction: async (scope, operation) => {
      mocks.context(scope)
      return operation({
        whatsAppConversation: { findFirst: mocks.conversation },
        whatsAppMessage: { findFirst: mocks.message },
      } as unknown as import('@prisma/client').Prisma.TransactionClient)
    },
  })
})
import { POST as integration } from '@/app/api/integrations/whatsapp/send/route'
import { POST as admin } from '@/app/api/admin/whatsapp/conversations/[conversationId]/messages/route'
import { POST as serviceIntegration } from '../../apps/services/api/src/app/api/integrations/whatsapp/send/route'
import { POST as serviceAdmin } from '../../apps/services/api/src/app/api/admin/whatsapp/conversations/[conversationId]/messages/route'
const principal = {
  tenantId: 'tenant-a',
  userId: 'user-a',
  membershipId: 'member-a',
  role: 'ADMIN',
}
const params = (conversationId = 'conversation-a') => ({
  params: Promise.resolve({ conversationId }),
})
const request = (body: unknown = { to: '551100000001', message: ' Olá ' }) =>
  new NextRequest('https://api.example.test/api', {
    method: 'POST',
    body: JSON.stringify(body),
  })
const malformed = () =>
  new NextRequest('https://api.example.test/api', { method: 'POST', body: '{' })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.principal.mockResolvedValue({ ok: true, principal })
  mocks.admin.mockResolvedValue({
    success: true,
    principal,
    tenantId: principal.tenantId,
  })
  mocks.conversation.mockResolvedValue({
    id: 'conversation-a',
    phone: '+551100000001',
  })
  mocks.message.mockResolvedValue({
    timestamp: new Date('2026-10-02T14:00:00Z'),
  })
  mocks.send.mockResolvedValue({
    providerMessageId: 'provider-a',
    conversationId: 'conversation-normalized',
    messageId: 'message-a',
  })
})
describe('WhatsApp write legacy characterization', () => {
  it.each([402, 403, 503] as const)(
    'both hosts transport subscription refusal %i for both send paths',
    async (status) => {
      const body = {
        error: 'Synthetic refusal',
        code: 'SUBSCRIPTION_RESTRICTED' as const,
      }
      mocks.send.mockRejectedValue(new SubscriptionCommandError(status, body))
      for (const handler of [integration, serviceIntegration]) {
        const response = await handler(request())
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual(body)
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('vary')).toBe('Cookie, Host')
      }
      for (const handler of [admin, serviceAdmin]) {
        const response = await handler(request({ text: 'Olá' }), params())
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual(body)
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('vary')).toBe('Cookie, Host')
      }
    }
  )
  it('both service send paths preserve successful legacy DTOs', async () => {
    expect(await (await serviceIntegration(request())).json()).toEqual({
      success: true,
      messageId: 'provider-a',
    })
    expect(
      await (await serviceAdmin(request({ text: 'Olá' }), params())).json()
    ).toMatchObject({ id: 'message-a', status: 'sent', body: 'Olá' })
  })
  it('returns principal refusal before reading body or sending', async () => {
    mocks.principal.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'No session' }, { status: 401 }),
    })
    const r = await integration(malformed())
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: 'No session' })
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it.each(['OPERATOR', 'FINANCIAL', 'CLIENT'])(
    'integration send requires tenant ADMIN (%s)',
    async (role) => {
      mocks.principal.mockResolvedValue({
        ok: true,
        principal: { ...principal, role },
      })
      const r = await integration(malformed())
      expect(r.status).toBe(403)
      expect(await r.json()).toEqual({ error: 'Forbidden' })
      expect(mocks.send).not.toHaveBeenCalled()
    }
  )
  it.each([
    {},
    null,
    { to: 'short', message: 'x' },
    { to: '551100000001', message: '  ' },
    { to: '551100000001', message: 'x', extra: true },
  ])('preserves strict integration schema %j', async (body) => {
    const r = await integration(request(body))
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({ error: 'Mensagem inválida' })
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it.each([{ templateId: 'template-a' }, { variables: {} }])(
    'quarantines template configuration %j',
    async (extra) => {
      const r = await integration(
        request({ to: '551100000001', message: 'x', ...extra })
      )
      expect(r.status).toBe(503)
      expect(await r.json()).toEqual({
        error: 'Templates requerem configuração específica da integração',
        code: 'WHATSAPP_TEMPLATE_UNAVAILABLE',
      })
      expect(mocks.send).not.toHaveBeenCalled()
    }
  )
  it('keeps empty templateId falsy and trims text before the shared sender', async () => {
    const r = await integration(
      request({ to: '551100000001', message: ' Olá ', templateId: '' })
    )
    expect(await r.json()).toEqual({ success: true, messageId: 'provider-a' })
    expect(mocks.send).toHaveBeenCalledWith(principal, '551100000001', 'Olá')
  })
  it.each([
    'WHATSAPP_INTEGRATION_UNAVAILABLE',
    'WHATSAPP_CREDENTIAL_UNAVAILABLE',
    'WHATSAPP_DELIVERY_UNCONFIRMED',
  ])('keeps send failure mapping %s', async (error) => {
    mocks.send.mockRejectedValue(new Error(error))
    const r = await integration(request())
    expect(r.status).toBe(error.includes('DELIVERY') ? 502 : 503)
    expect(await r.json()).toEqual({
      error: error.includes('DELIVERY')
        ? 'Envio não confirmado; confira o histórico antes de reenviar'
        : 'Integração WhatsApp da locadora indisponível',
    })
  })
  it('malformed integration JSON and thrown principal still use the legacy 502', async () => {
    expect((await integration(malformed())).status).toBe(502)
    mocks.principal.mockRejectedValue(new Error('session failure'))
    expect((await integration(request())).status).toBe(502)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('admin denies before body, parameter and SQL', async () => {
    mocks.admin.mockResolvedValue({
      success: false,
      error: 'Acesso negado',
      status: 403,
    })
    const r = await admin(malformed(), params(''))
    expect(r.status).toBe(403)
    expect(await r.json()).toEqual({ error: 'Acesso negado' })
    expect(mocks.context).not.toHaveBeenCalled()
  })
  it('admin keeps required id, malformed JSON and blank text errors', async () => {
    expect(
      await (await admin(request({ text: 'x' }), params(''))).json()
    ).toEqual({ error: 'conversationId é obrigatório' })
    expect(await (await admin(malformed(), params())).json()).toEqual({
      error: 'Body JSON inválido',
    })
    expect(
      await (await admin(request({ text: '  ' }), params())).json()
    ).toEqual({ error: 'Campo text é obrigatório' })
    expect(mocks.context).not.toHaveBeenCalled()
  })
  it('admin keeps JSON null outside its SQL/send catch', async () => {
    await expect(admin(request(null), params())).rejects.toBeInstanceOf(
      TypeError
    )
    expect(mocks.context).not.toHaveBeenCalled()
  })
  it('admin hides foreign conversation before send', async () => {
    mocks.conversation.mockResolvedValue(null)
    const r = await admin(request({ text: 'x' }), params('foreign'))
    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ error: 'Conversa não encontrada' })
    expect(mocks.conversation).toHaveBeenCalledWith({
      where: { id: 'foreign', tenantId: principal.tenantId },
    })
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('admin scopes both reads and preserves sender result DTO and timestamp', async () => {
    const r = await admin(request({ text: ' Olá ', ignored: true }), params())
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({
      id: 'message-a',
      conversationId: 'conversation-normalized',
      providerMessageId: 'provider-a',
      direction: 'OUTBOUND',
      type: 'TEXT',
      body: 'Olá',
      timestamp: '2026-10-02T14:00:00.000Z',
      status: 'sent',
    })
    expect(mocks.context.mock.calls).toEqual([[principal], [principal]])
    expect(mocks.send).toHaveBeenCalledWith(principal, '+551100000001', 'Olá')
    expect(mocks.message).toHaveBeenCalledWith({
      where: { id: 'message-a', tenantId: principal.tenantId },
    })
  })
  it('admin preserves Error.message and non-Error fallback', async () => {
    for (const failure of [
      new Error('WHATSAPP_INTEGRATION_UNAVAILABLE'),
      'failure',
    ]) {
      mocks.send.mockRejectedValueOnce(failure)
      const r = await admin(request({ text: 'x' }), params())
      expect(r.status).toBe(500)
      expect(await r.json()).toEqual({
        error:
          failure instanceof Error
            ? failure.message
            : 'Erro ao enviar mensagem',
      })
    }
  })
})
