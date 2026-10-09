import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createZohoMailClient,
  createZohoMailConfiguration,
  createZohoMailTokenReader,
} from '@gb-locacoes/backend/communications'
import type { TenantTransactionRunner } from '@gb-locacoes/backend/rentals'

const env = {
  ZOHO_CLIENT_ID: 'fixture-client',
  ZOHO_CLIENT_SECRET: 'fixture-secret',
  ZOHO_MAIL_DATACENTER: 'eu',
}
afterEach(() => vi.unstubAllGlobals())
describe('shared Zoho transport compatibility', () => {
  it.each(['com', 'eu', 'in', 'com.au', 'jp', 'ca', 'com.cn', 'sa'])(
    'uses allowlisted datacenter %s',
    (dc) => {
      expect(
        createZohoMailConfiguration({
          ZOHO_MAIL_DATACENTER: dc,
        }).getZohoMailBaseUrl()
      ).toBe(`https://mail.zoho.${dc}/api`)
    }
  )
  it('rejects a datacenter outside the closed list', () => {
    expect(() =>
      createZohoMailConfiguration({ ZOHO_MAIL_DATACENTER: 'example.test' })
    ).toThrow('INVALID_ZOHO_DATACENTER')
  })
  it.each([
    '../accounts',
    '/%2e/accounts',
    '/%2f/accounts',
    '/%5c/accounts',
    '/\\accounts',
    'https://foreign.test/api/accounts',
    'https://mail.zoho.eu/private',
  ])('refuses unsafe path %s before fetch', async (path) => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(
      createZohoMailClient(() => env).makeZohoMailRequest('fixture', path)
    ).rejects.toThrow('INVALID_ZOHO_API_PATH')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('preserves 19-digit IDs, request method/body, caller signal and refused redirects', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          '{"data":{"messageId":1234567890123456789,"folderId":1234567890123456788}}'
        )
      )
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    const result = await createZohoMailClient(() => env).makeZohoMailRequest(
      'fixture',
      '/accounts/one/messages',
      {
        method: 'PUT',
        body: { isRead: true },
        signal,
        searchParams: { limit: 0, skip: undefined, empty: '' },
      }
    )
    expect(result).toEqual({
      data: {
        messageId: '1234567890123456789',
        folderId: '1234567890123456788',
      },
    })
    expect(fetcher).toHaveBeenCalledWith(
      'https://mail.zoho.eu/api/accounts/one/messages?limit=0',
      expect.objectContaining({
        method: 'PUT',
        redirect: 'error',
        signal,
        body: '{"isRead":true}',
        headers: {
          Authorization: 'Zoho-oauthtoken fixture',
          'Content-Type': 'application/json',
        },
      })
    )
  })
  it('captures credentials at composition but reads the redirect environment for each OAuth call', async () => {
    const source = { ...env, NEXTAUTH_URL: 'https://legacy.example.test' }
    const client = createZohoMailClient(() => source)
    source.ZOHO_CLIENT_ID = 'later-client'
    source.NEXTAUTH_URL = 'https://later.example.test'
    const oauth = new URL(client.getZohoOAuthUrl('nonce'))
    expect(oauth.searchParams.get('client_id')).toBe('fixture-client')
    expect(oauth.searchParams.get('redirect_uri')).toBe(
      'https://later.example.test/api/admin/zoho-mail/oauth/callback'
    )
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
      })
    )
    vi.stubGlobal('fetch', fetcher)
    expect(await client.exchangeCodeForTokens('code')).toEqual({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      api_domain: undefined,
    })
    expect(fetcher.mock.calls[0]![1].redirect).toBe('error')
    expect(
      new URLSearchParams(fetcher.mock.calls[0]![1].body).get('redirect_uri')
    ).toBe(oauth.searchParams.get('redirect_uri'))
  })
  it.each([200, 503])(
    'keeps non-JSON provider response behavior at %s',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('not json', { status }))
      )
      const result = createZohoMailClient(() => env).makeZohoMailRequest(
        'fixture',
        '/accounts'
      )
      if (status === 200) expect(await result).toEqual({})
      else await expect(result).rejects.toThrow('Zoho Mail API: 503 not json')
    }
  )
  it('normalizes multipart attachment fallback names and sizes without a JSON content-type', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        attachments: [
          { storeName: 'store', attachmentName: 'a', attachmentPath: '/a' },
          { fileName: 'ignored' },
        ],
      })
    )
    vi.stubGlobal('fetch', fetcher)
    const result = await createZohoMailClient(
      () => env
    ).uploadZohoMailAttachments(
      'fixture',
      'account',
      [{ file: new File(['a'], 'x.txt'), fileName: 'x.txt', size: 1 }],
      { isInline: false }
    )
    expect(result).toEqual([
      {
        storeName: 'store',
        attachmentName: 'a',
        attachmentPath: '/a',
        fileName: 'x.txt',
        size: 1,
      },
    ])
    expect(fetcher.mock.calls[0]![0]).toContain(
      'uploadType=multipart&isInline=false'
    )
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      redirect: 'error',
      headers: { Authorization: 'Zoho-oauthtoken fixture' },
      body: expect.any(FormData),
    })
  })
  it('token reader uses tenant/user compound keys, rejects another datacenter and refreshes only expired tokens', async () => {
    const row = {
      datacenter: 'eu',
      expiresAt: new Date(Date.now() + 60_000),
      accessToken: 'stored',
      refreshToken: 'refresh',
      accountId: 'account',
    }
    const findUnique = vi.fn().mockImplementation(async () => row),
      update = vi.fn(),
      refresh = vi
        .fn()
        .mockResolvedValue({ access_token: 'renewed', expires_in: 3600 })
    const run: TenantTransactionRunner = (_context, operation) =>
      operation({
        zohoMailToken: { findUnique, update },
      } as unknown as Parameters<Parameters<TenantTransactionRunner>[1]>[0])
    const reader = createZohoMailTokenReader({
      withTenantTransaction: run,
      refreshAccessToken: refresh,
      getZohoMailBaseUrl: () => 'https://mail.zoho.eu/api',
    })
    expect(await reader.getZohoAccessToken({ tenantId: 'alfa' }, 'user')).toBe(
      'stored'
    )
    expect(refresh).not.toHaveBeenCalled()
    row.datacenter = 'com'
    expect(
      await reader.getZohoAccessToken({ tenantId: 'alfa' }, 'user')
    ).toBeNull()
    expect(refresh).not.toHaveBeenCalled()
    row.datacenter = 'eu'
    row.expiresAt = new Date(0)
    expect(await reader.getZohoAccessToken({ tenantId: 'alfa' }, 'user')).toBe(
      'renewed'
    )
    expect(update).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: 'alfa', userId: 'user' } },
      data: { accessToken: 'renewed', expiresAt: expect.any(Date) },
    })
    expect(await reader.getZohoAccountId({ tenantId: 'alfa' }, 'user')).toBe(
      'account'
    )
    expect(
      findUnique.mock.calls.every(
        ([args]) => args.where.tenantId_userId.tenantId === 'alfa'
      )
    ).toBe(true)
    refresh.mockRejectedValueOnce(new Error('provider unavailable'))
    expect(
      await reader.getZohoAccessToken({ tenantId: 'alfa' }, 'user')
    ).toBeNull()
  })
})
