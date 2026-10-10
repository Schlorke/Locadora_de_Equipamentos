import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  configured: vi.fn(),
  url: vi.fn(),
  exchange: vi.fn(),
  mail: vi.fn(),
  cookie: '',
  cookieReader: vi.fn(),
  deleteCookie: vi.fn(),
  create: vi.fn(),
  consume: vi.fn(),
  upsert: vi.fn(),
  disconnect: vi.fn(),
  tx: vi.fn(),
}))
vi.mock('next/headers', () => ({
  cookies: async () => {
    mocks.cookieReader()
    return {
      get: () => (mocks.cookie ? { value: mocks.cookie } : undefined),
      delete: mocks.deleteCookie,
    }
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
            error: result.error,
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
            error: result.error,
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
      getZohoOAuthUrl: mocks.url,
      isZohoOAuthConfigured: mocks.configured,
      exchangeCodeForTokens: mocks.exchange,
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
        context: unknown,
        operation: (_tx: unknown) => Promise<unknown>
      ) => {
        mocks.tx(context)
        return operation({
          authVerification: { create: mocks.create, deleteMany: mocks.consume },
          zohoMailToken: { upsert: mocks.upsert, deleteMany: mocks.disconnect },
        })
      },
    }))()),
  })
)
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/zoho-mail/oauth/authorize/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/zoho-mail/oauth/callback/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/zoho-mail/oauth/disconnect/route'

const HOSTS = [
  [
    'service',
    {
      authorize: serviceRoute0.GET,
      callback: serviceRoute1.GET,
      disconnect: serviceRoute2.DELETE,
    },
  ],
] as const

describe.each(HOSTS)('%s', (host, { authorize, callback, disconnect }) => {
  const principal = {
    tenantId: 'alfa',
    userId: 'operator',
    membershipId: 'active',
    role: 'OPERATOR',
  }
  const saved = { state: 'nonce', tenantId: 'alfa', userId: 'operator' }
  const request = (query = '') =>
    new NextRequest(
      'https://backend.example/api/admin/zoho-mail/oauth/callback?' + query
    )
  const error = (message: string) =>
    '/admin/email?error=' + encodeURIComponent(message)
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.gate.mockResolvedValue({
      success: true,
      principal,
      tenantId: principal.tenantId,
      user: { id: principal.userId },
    })
    mocks.configured.mockReturnValue(true)
    mocks.url.mockImplementation(
      (state) => 'https://accounts.zoho.com/oauth/v2/auth?state=' + state
    )
    mocks.cookie = JSON.stringify(saved)
    mocks.consume.mockResolvedValue({ count: 1 })
    mocks.exchange.mockResolvedValue({
      access_token: 'local-access',
      refresh_token: 'local-refresh',
      expires_in: 3600,
    })
    mocks.mail.mockResolvedValue({
      data: [{ accountId: '9007199254740993123' }],
    })
    mocks.disconnect.mockResolvedValue({ count: 1 })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })
  describe('Zoho OAuth legacy characterization', () => {
    it('authorize refuses explicit sibling Origin before creating state or setting cookies', async () => {
      const incoming = request()
      incoming.headers.set('Origin', 'https://bravo.example.test')
      const response = await authorize(incoming)
      expect(response.status).toBe(403)
      expect(response.headers.get('Set-Cookie')).toBeNull()
      expect(mocks.tx).not.toHaveBeenCalled()
      expect(mocks.url).not.toHaveBeenCalled()
    })
    it('callback refuses explicit sibling Origin without reading cookies, consuming state or exchanging code', async () => {
      const incoming = request('code=synthetic-code&state=nonce')
      incoming.headers.set('Origin', 'https://bravo.example.test')
      const response = await callback(incoming)
      expect(response.status).toBe(307)
      expect(response.headers.get('Location')).toContain('error=')
      for (const port of [
        mocks.tx,
        mocks.cookieReader,
        mocks.deleteCookie,
        mocks.consume,
        mocks.exchange,
        mocks.upsert,
      ])
        expect(port).not.toHaveBeenCalled()
    })
    it.each(['authorize', 'disconnect'])(
      '%s refuses before SQL/provider',
      async (name) => {
        mocks.gate.mockResolvedValue({
          success: false,
          status: 403,
          error: 'Acesso negado',
        })
        const r =
          name === 'authorize' ? await authorize(request()) : await disconnect()
        expect(r.status).toBe(403)
        expect(await r.json()).toEqual({ error: 'Acesso negado' })
        expect(mocks.tx).not.toHaveBeenCalled()
        expect(mocks.exchange).not.toHaveBeenCalled()
      }
    )
    it.each([
      ['error=access_denied', 'Acesso negado ao Zoho'],
      ['error=provider+error&code=fixture', 'provider error'],
      ['', 'Código de autorização não recebido'],
      ['code=fixture', 'Authentication required'],
    ])(
      'callback denial keeps received-code priority %s',
      async (query, message) => {
        mocks.gate.mockResolvedValue({
          success: false,
          status: 401,
          error: 'Authentication required',
        })
        const r = await callback(request(query))
        expect(r.status).toBe(307)
        expect(r.headers.get('location')).toBe(error(message))
        expect(mocks.cookieReader).not.toHaveBeenCalled()
        expect(mocks.tx).not.toHaveBeenCalled()
        expect(mocks.exchange).not.toHaveBeenCalled()
      }
    )
    it('keeps the Unauthorized spelling and role refusal redirect', async () => {
      for (const [denial, message] of [
        ['Unauthorized', 'Faça login como admin'],
        ['Acesso negado', 'Acesso negado'],
      ]) {
        mocks.gate.mockResolvedValue({
          success: false,
          status: 403,
          error: denial,
        })
        expect(
          (await callback(request('code=fixture'))).headers.get('location')
        ).toBe(error(message!))
      }
    })
    it.each(['', 'error=access_denied'])(
      'authenticated callback keeps early redirect without deleting cookie %s',
      async (query) => {
        expect((await callback(request(query))).status).toBe(307)
        expect(mocks.cookieReader).not.toHaveBeenCalled()
        expect(mocks.consume).not.toHaveBeenCalled()
      }
    )
    it('authorize stores only the digest bound to current tenant/user, sets the exact secure cookie and lifetime', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-02T12:00:00Z'))
      vi.stubEnv('NODE_ENV', 'production')
      const r = await authorize(request())
      expect(r.status).toBe(307)
      const state = new URL(r.headers.get('location')!).searchParams.get(
        'state'
      )!
      expect(state).toMatch(/^[a-f0-9]{32}$/)
      expect(mocks.create.mock.calls[0]![0].data).toMatchObject({
        identifier: 'zoho-oauth:alfa:operator',
        value: createHash('sha256').update(state).digest('hex'),
        expiresAt: new Date('2026-10-02T12:10:00Z'),
      })
      expect(mocks.tx).toHaveBeenCalledWith(principal)
      const cookie = r.headers.get('set-cookie')!
      expect(cookie).toContain('Max-Age=600')
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('Secure')
      expect(cookie).toContain('SameSite=lax')
      expect(cookie).toContain('Path=/')
      expect(cookie).not.toContain('Domain=')
      expect(
        JSON.parse(
          decodeURIComponent(
            cookie.split(';')[0]!.slice('zoho_oauth_state='.length)
          )
        )
      ).toEqual({ state, tenantId: 'alfa', userId: 'operator' })
    })
    it('authorize keeps development cookie and missing configuration redirect without creating state', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      expect(
        (await authorize(request())).headers.get('set-cookie')
      ).not.toContain('Secure')
      mocks.tx.mockClear()
      mocks.configured.mockReturnValue(false)
      const r = await authorize(request())
      expect(r.status).toBe(307)
      expect(new URL(r.headers.get('location')!).origin).toBe(
        'https://backend.example'
      )
      expect(r.headers.get('set-cookie')).toBeNull()
      expect(mocks.tx).not.toHaveBeenCalled()
      expect(
        new URL(r.headers.get('location')!).searchParams.get('error')
      ).toBe(
        encodeURIComponent(
          'Zoho Mail não está configurado. Configure ZOHO_CLIENT_ID e ZOHO_CLIENT_SECRET no arquivo .env.'
        )
      )
    })
    it.each([
      ['', 'Estado OAuth inválido para esta locadora'],
      ['{', 'Estado OAuth inválido'],
      ['null', 'Estado OAuth inválido'],
      ['[]', 'Estado OAuth inválido'],
      ['"nonce"', 'Estado OAuth inválido'],
      ['123', 'Estado OAuth inválido'],
      ['true', 'Estado OAuth inválido'],
      [
        JSON.stringify({ ...saved, state: 'other' }),
        'Estado OAuth inválido para esta locadora',
      ],
      [
        JSON.stringify({ ...saved, tenantId: 'bravo' }),
        'Estado OAuth inválido para esta locadora',
      ],
      [
        JSON.stringify({ ...saved, userId: 'foreign' }),
        'Estado OAuth inválido para esta locadora',
      ],
    ])(
      'callback refuses malformed/missing/cross-scope cookie %s before state SQL',
      async (cookie, message) => {
        mocks.cookie = cookie!
        const r = await callback(request('code=fixture&state=nonce'))
        expect(r.headers.get('location')).toBe(error(message!))
        expect(mocks.deleteCookie).toHaveBeenCalledWith('zoho_oauth_state')
        expect(mocks.consume).not.toHaveBeenCalled()
        expect(mocks.exchange).not.toHaveBeenCalled()
      }
    )
    it('callback refuses missing state without SQL and deletes its cookie', async () => {
      expect(
        (await callback(request('code=fixture'))).headers.get('location')
      ).toBe(error('Estado OAuth inválido para esta locadora'))
      expect(mocks.deleteCookie).toHaveBeenCalled()
      expect(mocks.consume).not.toHaveBeenCalled()
    })
    it.each([0, 2])(
      'callback rejects expired/reused or duplicate states (count %s) before exchange',
      async (count) => {
        mocks.consume.mockResolvedValue({ count })
        const r = await callback(request('code=fixture&state=nonce'))
        expect(r.headers.get('location')).toBe(
          error('Estado OAuth expirado ou já utilizado')
        )
        expect(mocks.exchange).not.toHaveBeenCalled()
        expect(mocks.consume.mock.calls[0]![0].where).toMatchObject({
          identifier: 'zoho-oauth:alfa:operator',
          value: createHash('sha256').update('nonce').digest('hex'),
          expiresAt: { gt: expect.any(Date) },
        })
      }
    )
    it('exchange failure consumes the state and clears the cookie before safe redirect', async () => {
      mocks.exchange.mockRejectedValue(new Error('private token failure'))
      const r = await callback(request('code=fixture&state=nonce'))
      expect(r.headers.get('location')).toBe(
        error('Falha ao conectar conta de e-mail')
      )
      expect(mocks.upsert).not.toHaveBeenCalled()
      expect(mocks.consume.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.exchange.mock.invocationCallOrder[0]!
      )
      expect(mocks.deleteCookie).toHaveBeenCalled()
    })
    it.each([
      { data: [{ accountId: 'account-a' }] },
      { accounts: [{ id: 'account-a' }] },
      { data: [], accounts: [{ id: 'ignored' }] },
    ])(
      'preserves account envelope %j and token upsert with tenant/user compound key',
      async (result) => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-02T12:00:00Z'))
        vi.stubEnv('ZOHO_MAIL_DATACENTER', 'com.au')
        mocks.mail.mockResolvedValue(result)
        const r = await callback(request('code=fixture&state=nonce'))
        expect(r.status).toBe(307)
        expect(r.headers.get('location')).toBe('/admin/email?success=true')
        const accountId =
          Array.isArray(result.data) && result.data.length === 0
            ? null
            : 'account-a'
        expect(mocks.upsert).toHaveBeenCalledWith({
          where: { tenantId_userId: { tenantId: 'alfa', userId: 'operator' } },
          create: {
            tenantId: 'alfa',
            userId: 'operator',
            accessToken: 'local-access',
            refreshToken: 'local-refresh',
            expiresAt: new Date('2026-10-02T12:59:00Z'),
            accountId,
            datacenter: 'com.au',
          },
          update: {
            accessToken: 'local-access',
            refreshToken: 'local-refresh',
            expiresAt: new Date('2026-10-02T12:59:00Z'),
            accountId,
            datacenter: 'com.au',
          },
        })
      }
    )
    it('account discovery failure still stores null account while SQL failures propagate', async () => {
      mocks.mail.mockRejectedValue(new Error('provider accounts failed'))
      expect(
        (await callback(request('code=fixture&state=nonce'))).headers.get(
          'location'
        )
      ).toBe('/admin/email?success=true')
      expect(mocks.upsert.mock.calls[0]![0].create.accountId).toBeNull()
      mocks.upsert.mockRejectedValue(new Error('SQL failed'))
      await expect(
        callback(request('code=fixture&state=nonce'))
      ).rejects.toThrow('SQL failed')
    })
    it('disconnect deletes only current tenant/user token and never revokes with provider', async () => {
      const r = await disconnect()
      expect(await r.json()).toEqual({ success: true })
      expect(mocks.disconnect).toHaveBeenCalledWith({
        where: { tenantId: 'alfa', userId: 'operator' },
      })
      expect(mocks.tx).toHaveBeenCalledWith(principal)
      expect(mocks.exchange).not.toHaveBeenCalled()
      expect(mocks.consume).not.toHaveBeenCalled()
    })
    // Só o contrato do require-admin da raiz admite "sucesso sem usuário"; o principal do serviço
    // (resolveTenantPrincipal) sempre traz o userId, então o caso não existe nele.
    // F: the deleted root require-admin success-without-user state is outside the service principal contract.
  })
})
