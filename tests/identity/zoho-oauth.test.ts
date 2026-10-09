// OAuth do Zoho Mail com a plataforma multi-host (ADR adr-tenant-hosts, Lote 6): redirect URI fixo no host app,
// nunca derivado do Host da requisição; o state continua preso à locadora e ao usuário; a volta ao painel é
// relativa ao host que recebeu o callback (o app), não a uma origem configurada à parte.
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => {
  // lib/zoho-mail/client.ts lê o client id ao carregar o módulo.
  process.env.ZOHO_CLIENT_ID = 'fixture-zoho-client'
  process.env.ZOHO_CLIENT_SECRET = 'fixture-zoho-secret'
  return {
    cookie: '',
    deleted: vi.fn(),
    tx: {
      authVerification: { deleteMany: vi.fn() },
      zohoMailToken: { upsert: vi.fn() },
    },
  }
})
vi.mock('@/lib/tenant', () => ({
  withTenantTransaction: async (
    _context: unknown,
    operation: (_tx: unknown) => Promise<unknown>
  ) => operation(mocks.tx),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/middlewares/require-admin', () => ({
  requireAdminOrOperator: async () => ({
    success: true,
    user: { id: 'user-A' },
    tenantId: 'tenant-A',
    principal: {
      tenantId: 'tenant-A',
      userId: 'user-A',
      membershipId: 'membership-A',
      role: 'ADMIN',
    },
  }),
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => ({ value: mocks.cookie }),
    delete: mocks.deleted,
  }),
}))

import { NextRequest } from 'next/server'
import {
  exchangeCodeForTokens,
  getZohoOAuthUrl,
  getZohoRedirectUri,
} from '@/lib/zoho-mail/client'
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
        tenantId: 'tenant-A',
        principal: {
          tenantId: 'tenant-A',
          userId: 'user-A',
          membershipId: 'membership-A',
          role: 'ADMIN',
        },
      }),
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
      requireAdminOrOperator: async () => ({
        success: true,
        user: { id: 'user-A' },
        tenantId: 'tenant-A',
        principal: {
          tenantId: 'tenant-A',
          userId: 'user-A',
          membershipId: 'membership-A',
          role: 'ADMIN',
        },
      }),
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
import * as legacyRoute0 from '@/app/api/admin/zoho-mail/oauth/callback/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/zoho-mail/oauth/callback/route'

const HOSTS = [
  [
    'legacy root',
    {
      callback: legacyRoute0.GET,
    },
  ],
  [
    'service',
    {
      callback: serviceRoute0.GET,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { callback }) => {
  const platform = {
    PLATFORM_ENV: 'production',
    PLATFORM_ROOT_DOMAIN: 'plataforma.example',
    PLATFORM_EDGE_SECRET: 'fixture-edge-secret-with-more-than-32-chars',
    WEB_API_ORIGIN: 'https://backend.example',
  }
  const APP_CALLBACK =
    'https://app.plataforma.example/api/admin/zoho-mail/oauth/callback'

  beforeEach(() => {
    vi.resetAllMocks()
    mocks.cookie = JSON.stringify({
      state: 'nonce',
      tenantId: 'tenant-A',
      userId: 'user-A',
    })
    mocks.tx.authVerification.deleteMany.mockResolvedValue({ count: 1 })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
  afterAll(() => {
    delete process.env.ZOHO_CLIENT_ID
    delete process.env.ZOHO_CLIENT_SECRET
  })

  describe('redirect URI do Zoho', () => {
    it('com a plataforma multi-host, é fixo no host app', () => {
      expect(getZohoRedirectUri(platform)).toBe(APP_CALLBACK)
      expect(
        getZohoRedirectUri({
          ...platform,
          NEXTAUTH_URL: 'https://locadora-a.plataforma.example',
        })
      ).toBe(APP_CALLBACK)
      expect(
        getZohoRedirectUri({
          ...platform,
          ZOHO_REDIRECT_URI: `${APP_CALLBACK}/`,
        })
      ).toBe(APP_CALLBACK)
    })

    it('um ZOHO_REDIRECT_URI fora do app é erro de configuração', () => {
      expect(() =>
        getZohoRedirectUri({
          ...platform,
          ZOHO_REDIRECT_URI:
            'https://locadora-a.plataforma.example/api/admin/zoho-mail/oauth/callback',
        })
      ).toThrow('ZOHO_REDIRECT_URI')
    })

    it('no legado sem plataforma, segue ZOHO_REDIRECT_URI ou NEXTAUTH_URL', () => {
      expect(
        getZohoRedirectUri({
          NODE_ENV: 'production',
          NEXTAUTH_URL: 'https://legado.example/',
        })
      ).toBe('https://legado.example/api/admin/zoho-mail/oauth/callback')
      expect(
        getZohoRedirectUri({
          NODE_ENV: 'production',
          ZOHO_REDIRECT_URI: 'https://legado.example/zoho/callback/',
        })
      ).toBe('https://legado.example/zoho/callback')
    })

    it('autorização e troca do código usam o mesmo redirect fixo', async () => {
      for (const [key, value] of Object.entries(platform))
        vi.stubEnv(key, value)
      vi.stubEnv('NEXTAUTH_URL', 'https://legado.example')
      const authorize = new URL(getZohoOAuthUrl('nonce'))
      expect(authorize.searchParams.get('redirect_uri')).toBe(APP_CALLBACK)
      expect(authorize.searchParams.get('state')).toBe('nonce')

      const fetchStub = vi.fn(async () =>
        Response.json({
          access_token: 'a',
          refresh_token: 'r',
          expires_in: 3600,
        })
      )
      vi.stubGlobal('fetch', fetchStub)
      await exchangeCodeForTokens('fixture-code')
      const body = new URLSearchParams(
        String(
          (fetchStub.mock.calls[0] as unknown as [string, RequestInit])[1].body
        )
      )
      expect(body.get('redirect_uri')).toBe(APP_CALLBACK)
    })
  })

  describe('callback do Zoho', () => {
    it('volta ao painel por caminho relativo (o host que recebeu o callback), nunca por NEXTAUTH_URL', async () => {
      vi.stubEnv('NEXTAUTH_URL', 'https://legado.example')
      const denied = await callback(
        new NextRequest(
          'https://backend.example/api/admin/zoho-mail/oauth/callback?error=access_denied'
        )
      )
      expect(denied.status).toBe(307)
      expect(denied.headers.get('location')).toBe(
        `/admin/email?error=${encodeURIComponent('Acesso negado ao Zoho')}`
      )
    })

    it('state de outra locadora ou usuário é recusado antes da troca do código', async () => {
      const fetchStub = vi.fn()
      vi.stubGlobal('fetch', fetchStub)
      mocks.cookie = JSON.stringify({
        state: 'nonce',
        tenantId: 'tenant-B',
        userId: 'user-A',
      })
      const response = await callback(
        new NextRequest('https://backend.example/api?code=fixture&state=nonce')
      )
      expect(response.headers.get('location')).toMatch(
        /^\/admin\/email\?error=/
      )
      expect(mocks.tx.authVerification.deleteMany).not.toHaveBeenCalled()
      expect(fetchStub).not.toHaveBeenCalled()
      expect(mocks.tx.zohoMailToken.upsert).not.toHaveBeenCalled()
    })
  })
})
