import { NextRequest } from 'next/server'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  })
  return {
    tx: {
      zohoMailToken: model(),
      authVerification: model(),
      tenantIntegration: model(),
      whatsAppConversation: model(),
      whatsAppMessage: model(),
    },
    context: vi.fn(),
    refresh: vi.fn(),
    exchange: vi.fn(),
    mail: vi.fn(),
    credential: vi.fn(),
    cookie: '',
    tenantId: 'tenant-A',
  }
})
vi.mock('@/lib/tenant', () => ({
  withTenantTransaction: async (
    context: unknown,
    fn: (_tx: unknown) => Promise<unknown>
  ) => {
    mocks.context(context)
    return fn(mocks.tx)
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/security/tenant-webhook', () => ({
  resolveIntegrationCredential: mocks.credential,
}))
vi.mock('@/middlewares/require-admin', () => ({
  requireAdminOrOperator: async () => ({
    success: true,
    user: { id: 'user-A' },
    tenantId: mocks.tenantId,
    principal: {
      tenantId: mocks.tenantId,
      userId: 'user-A',
      membershipId: 'membership-A',
      role: 'ADMIN',
    },
  }),
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => ({ value: mocks.cookie }),
    delete: vi.fn(),
  }),
}))
vi.mock('@/lib/zoho-mail/client', () => ({
  refreshAccessToken: mocks.refresh,
  exchangeCodeForTokens: mocks.exchange,
  makeZohoMailRequest: mocks.mail,
  isZohoOAuthConfigured: () => true,
  getZohoOAuthUrl: () => 'https://accounts.zoho.com/auth',
}))
import { getZohoAccessToken } from '@/lib/zoho-mail/get-access-token'
import { sendTextMessage } from '@/lib/meta-whatsapp'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: {} }),
}))
vi.mock(
  '../../apps/services/api/src/host/private-identity',
  async (importOriginal) => {
    const legacy = (await (() => ({
      requireAdminOrOperator: async () => ({
        success: true,
        user: { id: 'user-A' },
        tenantId: mocks.tenantId,
        principal: {
          tenantId: mocks.tenantId,
          userId: 'user-A',
          membershipId: 'membership-A',
          role: 'ADMIN',
        },
      }),
    }))()) as Record<
      string,
      (request?: unknown) => Promise<{
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
      requireAdminOrOperator: async () => ({
        success: true,
        user: { id: 'user-A' },
        tenantId: mocks.tenantId,
        principal: {
          tenantId: mocks.tenantId,
          userId: 'user-A',
          membershipId: 'membership-A',
          role: 'ADMIN',
        },
      }),
    }))()) as Record<
      string,
      (request?: unknown) => Promise<{
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
      refreshAccessToken: mocks.refresh,
      exchangeCodeForTokens: mocks.exchange,
      makeZohoMailRequest: mocks.mail,
      isZohoOAuthConfigured: () => true,
      getZohoOAuthUrl: () => 'https://accounts.zoho.com/auth',
    }))()
    return { createZohoMailClient: () => F }
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
        context: unknown,
        fn: (_tx: unknown) => Promise<unknown>
      ) => {
        mocks.context(context)
        return fn(mocks.tx)
      },
    }))()),
  })
)
vi.mock(
  '../../apps/services/api/src/host/webhook-authentication',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/webhook-authentication')
    >()),
    ...(await (() => ({
      resolveIntegrationCredential: mocks.credential,
    }))()),
  })
)
import * as legacyRoute0 from '@/app/api/admin/zoho-mail/oauth/callback/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/zoho-mail/oauth/callback/route'
import * as legacyRoute1 from '@/app/api/admin/zoho-mail/oauth/disconnect/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/zoho-mail/oauth/disconnect/route'

const HOSTS = [
  [
    'legacy root',
    {
      callback: legacyRoute0.GET,
      disconnect: legacyRoute1.DELETE,
    },
  ],
  [
    'service',
    {
      callback: serviceRoute0.GET,
      disconnect: serviceRoute1.DELETE,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { callback, disconnect }) => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.tenantId = 'tenant-A'
    mocks.cookie = JSON.stringify({
      state: 'nonce',
      tenantId: 'tenant-A',
      userId: 'user-A',
    })
    mocks.tx.zohoMailToken.findUnique.mockResolvedValue({
      accessToken: 'fixture-access',
      expiresAt: new Date(Date.now() + 60_000),
      datacenter: 'com',
    })
    mocks.tx.authVerification.deleteMany.mockResolvedValue({ count: 1 })
    mocks.exchange.mockResolvedValue({
      access_token: 'fixture-access',
      refresh_token: 'fixture-refresh',
      expires_in: 3600,
    })
    mocks.mail.mockResolvedValue({ data: [{ accountId: '123' }] })
    mocks.tx.tenantIntegration.findMany.mockResolvedValue([
      {
        id: 'integration-A',
        tenantId: 'tenant-A',
        externalAccountId: '12345',
        credentialsRef: 'env:LOCADORA_INTEGRATION_TEST',
      },
    ])
    mocks.credential.mockResolvedValue({ apiKey: 'fixture-access' })
    mocks.tx.whatsAppConversation.upsert.mockResolvedValue({
      id: 'conversation-A',
    })
    mocks.tx.whatsAppMessage.create.mockResolvedValue({
      id: 'message-A',
      conversationId: 'conversation-A',
    })
    mocks.tx.whatsAppMessage.updateMany.mockResolvedValue({ count: 1 })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ messages: [{ id: 'provider-message' }] })
        )
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  describe('messaging grants scoped to tenant', () => {
    it('reads Zoho grant through the composite tenant/user key', async () => {
      await getZohoAccessToken({ tenantId: 'tenant-A' }, 'user-A')
      expect(mocks.tx.zohoMailToken.findUnique.mock.calls[0][0].where).toEqual({
        tenantId_userId: { tenantId: 'tenant-A', userId: 'user-A' },
      })
    })
    it('never refreshes a grant from a mismatched data center', async () => {
      mocks.tx.zohoMailToken.findUnique.mockResolvedValue({
        expiresAt: new Date(0),
        datacenter: 'eu',
        refreshToken: 'fixture-refresh',
      })
      expect(
        await getZohoAccessToken({ tenantId: 'tenant-A' }, 'user-A')
      ).toBeNull()
      expect(mocks.refresh).not.toHaveBeenCalled()
    })
    it('rejects OAuth callback after changing selected tenant', async () => {
      mocks.tenantId = 'tenant-B'
      const response = await callback(
        new NextRequest('http://localhost/api?code=fixture&state=nonce')
      )
      expect(response.headers.get('location')).toContain('error=')
      expect(mocks.exchange).not.toHaveBeenCalled()
      expect(mocks.tx.zohoMailToken.upsert).not.toHaveBeenCalled()
    })
    it('consumes OAuth state once before external token exchange', async () => {
      await callback(
        new NextRequest('http://localhost/api?code=fixture&state=nonce')
      )
      expect(
        mocks.tx.authVerification.deleteMany.mock.calls[0][0].where.identifier
      ).toBe('zoho-oauth:tenant-A:user-A')
      expect(
        mocks.tx.zohoMailToken.upsert.mock.calls[0][0].create
      ).toMatchObject({
        tenantId: 'tenant-A',
        userId: 'user-A',
        accountId: '123',
      })
      mocks.tx.authVerification.deleteMany.mockResolvedValue({ count: 0 })
      await callback(
        new NextRequest('http://localhost/api?code=fixture&state=nonce')
      )
      expect(mocks.exchange).toHaveBeenCalledOnce()
    })
    it('disconnects only the selected tenant grant', async () => {
      expect((await disconnect()).status).toBe(200)
      expect(mocks.tx.zohoMailToken.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-A', userId: 'user-A' },
      })
    })
    it('resolves outbound WhatsApp account from tenant integration and stores tenant rows', async () => {
      await sendTextMessage(
        { tenantId: 'tenant-A' },
        '5511999999999',
        'Fixture'
      )
      expect(fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/12345/messages',
        expect.objectContaining({ redirect: 'error' })
      )
      expect(
        mocks.tx.whatsAppConversation.upsert.mock.calls[0][0].where
      ).toEqual({
        tenantId_phone: { tenantId: 'tenant-A', phone: '+5511999999999' },
      })
      expect(
        mocks.tx.whatsAppMessage.create.mock.calls[0][0].data.tenantId
      ).toBe('tenant-A')
    })
    it('fails closed for ambiguous WhatsApp integration without reading global secrets', async () => {
      mocks.tx.tenantIntegration.findMany.mockResolvedValue([])
      await expect(
        sendTextMessage({ tenantId: 'tenant-A' }, '5511999999999', 'Fixture')
      ).rejects.toThrow('WHATSAPP_INTEGRATION_UNAVAILABLE')
      expect(fetch).not.toHaveBeenCalled()
    })
    it('persists unknown outbound result without inventing a provider ID', async () => {
      vi.mocked(fetch).mockResolvedValue(Response.json({ messages: [] }))
      await expect(
        sendTextMessage({ tenantId: 'tenant-A' }, '5511999999999', 'Fixture')
      ).rejects.toThrow('WHATSAPP_DELIVERY_UNCONFIRMED')
      expect(mocks.tx.whatsAppMessage.updateMany.mock.calls[0][0].data).toEqual(
        {
          status: 'unknown',
        }
      )
    })
  })
})
