import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { normalizeFromAddress } from '../../packages/backend/src/modules/communications/zoho-address'

const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  token: vi.fn(),
  account: vi.fn(),
  mail: vi.fn(),
  fetch: vi.fn(),
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
vi.mock('@gb-locacoes/backend/communications', async (importOriginal) => {
  const sharedTokens: Record<string, unknown> = {}
  void sharedTokens
  return {
    ...(await importOriginal<
      typeof import('@gb-locacoes/backend/communications')
    >()),
    ...(await (async () => {
      const F = await (() => ({
        getZohoAccountId: mocks.account,
      }))()
      Object.assign(sharedTokens, F)
      return { createZohoMailTokenReader: () => sharedTokens }
    })()),
    ...(await (async () => {
      const F = await (async () => {
        return {
          getZohoAccessToken: mocks.token,
          makeZohoMailRequest: mocks.mail,
          getZohoMailBaseUrl: () => 'https://mail.zoho.com/api',
          ZOHO_MAIL_API_BASE: 'https://mail.zoho.com/api',
        }
      })()
      Object.assign(sharedTokens, F)
      return {
        createZohoMailClient: () => F,
        createZohoMailTokenReader: () => Object.assign(sharedTokens, F),
      }
    })()),
  }
})
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/zoho-mail/accounts/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/zoho-mail/folders/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/zoho-mail/messages/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/zoho-mail/messages/[messageId]/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/zoho-mail/messages/[messageId]/attachments/[attachmentId]/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/admin/zoho-mail/messages/[messageId]/inline/route'

const HOSTS = [
  [
    'service',
    {
      accounts: serviceRoute0.GET,
      folders: serviceRoute1.GET,
      messages: serviceRoute2.GET,
      detail: serviceRoute3.GET,
      attachment: serviceRoute4.GET,
      inline: serviceRoute5.GET,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (host, { accounts, folders, messages, detail, attachment, inline }) => {
    const context = { tenantId: 'alfa', userId: 'operator', role: 'OPERATOR' }
    const request = (
      query = 'accountId=account-a&folderId=inbox&contentId=logo'
    ) => new NextRequest('http://localhost/api?' + query)
    const params = () => ({
      params: Promise.resolve({
        messageId: 'message-a',
        attachmentId: 'attachment-a',
      }),
    })
    const cases = [
      {
        name: 'accounts',
        run: (r = request()) => accounts(r),
        needsAccount: false,
      },
      {
        name: 'folders',
        run: (r = request()) => folders(r),
        needsAccount: true,
      },
      {
        name: 'messages',
        run: (r = request()) => messages(r),
        needsAccount: true,
      },
      {
        name: 'detail',
        run: (r = request()) => detail(r, params()),
        needsAccount: true,
      },
      {
        name: 'attachment',
        run: (r = request()) => attachment(r, params()),
        needsAccount: true,
      },
      {
        name: 'inline',
        run: (r = request()) => inline(r, params()),
        needsAccount: true,
      },
    ]
    beforeEach(() => {
      vi.resetAllMocks()
      mocks.gate.mockResolvedValue({
        success: true,
        principal: context,
        user: { id: context.userId },
      })
      mocks.account.mockResolvedValue('account-a')
      mocks.token.mockResolvedValue('local-token')
      mocks.mail.mockResolvedValue({ data: [] })
      mocks.fetch.mockResolvedValue(
        new Response(new Uint8Array([0, 127, 255]), {
          headers: { 'Content-Type': 'image/png' },
        })
      )
      vi.stubGlobal('fetch', mocks.fetch)
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => vi.unstubAllGlobals())
    describe('Zoho read API characterization shared by the legacy facade', () => {
      it.each(cases)(
        '$name validates explicit sibling Origin before account, refresh or provider',
        async ({ run }) => {
          const incoming = request()
          incoming.headers.set('Origin', 'https://bravo.example.test')
          const response = await run(incoming)
          expect(response.status).toBe(403)
          expect(response.headers.get('Cache-Control')).toBe('no-store')
          for (const port of [
            mocks.account,
            mocks.token,
            mocks.mail,
            mocks.fetch,
          ])
            expect(port).not.toHaveBeenCalled()
        }
      )
      it.each(cases)(
        '$name still accepts same-origin and requests without Origin',
        async ({ run }) => {
          mocks.fetch.mockImplementation(
            async () =>
              new Response(new Uint8Array([0, 127, 255]), {
                headers: { 'Content-Type': 'image/png' },
              })
          )
          const incoming = request()
          incoming.headers.set('Origin', 'http://localhost')
          incoming.headers.set('Sec-Fetch-Site', 'same-origin')
          expect((await run(incoming)).status).toBe(200)
          expect((await run(request())).status).toBe(200)
        }
      )
      it.each(cases)(
        '$name refuses before account, token or transport',
        async ({ run }) => {
          mocks.gate.mockResolvedValue({
            success: false,
            status: 403,
            error: 'Acesso negado',
          })
          const r = await run()
          expect(r.status).toBe(403)
          expect(await r.json()).toEqual({ error: 'Acesso negado' })
          for (const port of [
            mocks.account,
            mocks.token,
            mocks.mail,
            mocks.fetch,
          ])
            expect(port).not.toHaveBeenCalled()
        }
      )
      // Só o contrato do require-admin da raiz admite "sucesso sem usuário"; o principal do serviço
      // (resolveTenantPrincipal) sempre traz o userId, então o caso não existe nele.
      // F: the deleted root require-admin success-without-user state is outside the service principal contract.
      it.each(cases.filter((c) => c.needsAccount))(
        '$name rejects missing params before ownership lookup',
        async ({ run }) => {
          expect((await run(request(''))).status).toBe(400)
          expect(mocks.account).not.toHaveBeenCalled()
          expect(mocks.token).not.toHaveBeenCalled()
        }
      )
      it.each(cases.filter((c) => c.needsAccount))(
        '$name rejects a different account before token refresh',
        async ({ run }) => {
          mocks.account.mockResolvedValue('foreign-account')
          const r = await run()
          expect(r.status).toBe(403)
          expect(await r.json()).toEqual({
            error: 'Conta de e-mail não autorizada nesta locadora',
          })
          expect(mocks.account).toHaveBeenCalledWith(context, context.userId)
          expect(mocks.token).not.toHaveBeenCalled()
          expect(mocks.mail).not.toHaveBeenCalled()
          expect(mocks.fetch).not.toHaveBeenCalled()
        }
      )
      it.each(cases)(
        '$name preserves disconnected-account refusal',
        async ({ name, run }) => {
          mocks.token.mockResolvedValue(null)
          const r = await run()
          expect(r.status).toBe(401)
          expect(await r.json()).toEqual({
            error:
              name === 'attachment'
                ? 'Zoho Mail não conectado. Conecte em /admin/email.'
                : 'Zoho Mail não conectado. Conecte em Configurações.',
          })
          expect(mocks.token).toHaveBeenCalledWith(context, context.userId)
          expect(mocks.mail).not.toHaveBeenCalled()
          expect(mocks.fetch).not.toHaveBeenCalled()
        }
      )
      it.each(cases)(
        '$name retains thrown transport errors as 500',
        async ({ run }) => {
          mocks.mail.mockRejectedValue(
            new Error('provider fixture unavailable')
          )
          mocks.fetch.mockRejectedValue(
            new Error('provider fixture unavailable')
          )
          const r = await run()
          expect(r.status).toBe(500)
          expect(await r.json()).toEqual({
            error: 'provider fixture unavailable',
          })
        }
      )
      it.each([['data'], ['accounts'], ['none']])(
        'accounts accepts envelope %s',
        async (key) => {
          mocks.mail.mockResolvedValue(
            key === 'none' ? {} : { [key]: [{ accountId: 'large-id' }] }
          )
          expect(await (await accounts()).json()).toEqual({
            accounts: key === 'none' ? [] : [{ accountId: 'large-id' }],
          })
          expect(mocks.mail).toHaveBeenCalledWith('local-token', '/accounts')
        }
      )
      it.each(['data', 'folders'])(
        'folders accepts envelope %s',
        async (key) => {
          mocks.mail.mockResolvedValue({
            [key]: [{ folderId: 'large-folder-id' }],
          })
          expect(await (await folders(request())).json()).toEqual({
            folders: [{ folderId: 'large-folder-id' }],
          })
        }
      )
      it.each([
        ['', 50, 0],
        ['limit=250&start=9', 100, 9],
        ['limit=0&start=NaN', 50, 0],
        ['limit=-7&start=-9', -7, -9],
        ['limit=2.5&start=1.5', 2.5, 1.5],
      ])(
        'preserves pagination coercion for %s',
        async (query, limit, start) => {
          await messages(request('accountId=account-a&folderId=inbox&' + query))
          expect(mocks.mail).toHaveBeenCalledWith(
            'local-token',
            '/accounts/account-a/messages/view',
            { searchParams: { folderId: 'inbox', limit, start } }
          )
        }
      )
      it('normalizes sender and read status without losing provider fields', async () => {
        mocks.mail.mockResolvedValue({
          messages: [
            {
              messageId: '9007199254740993123',
              sender: 'Ana &lt;ana@example.test&gt;',
              status: '0',
              custom: 42,
            },
            {
              fromAddress: { emailAddress: 'b@example.test' },
              isRead: true,
              status: '0',
            },
            { fromAddress: '', status: 'unknown' },
            null,
          ],
        })
        expect(await (await messages(request())).json()).toEqual({
          messages: [
            {
              messageId: '9007199254740993123',
              sender: 'Ana &lt;ana@example.test&gt;',
              status: '0',
              custom: 42,
              fromAddress: {
                displayName: 'Ana',
                emailAddress: 'ana@example.test',
              },
              isRead: false,
            },
            {
              fromAddress: { emailAddress: 'b@example.test' },
              isRead: true,
              status: '0',
            },
            { fromAddress: { emailAddress: '' }, status: 'unknown' },
            {},
          ],
        })
        expect(normalizeFromAddress(null)).toBeUndefined()
      })
      it('loads details and content, normalizes recipients and rewrites cid and webmail image URLs', async () => {
        mocks.mail.mockImplementation(async (_token, path) => {
          if (path.endsWith('/details'))
            return {
              data: {
                messageId: '9007199254740993123',
                subject: 'Mail',
                sender: 'Ana <ana@example.test>',
                toAddress: ['Bob <bob@example.test>', null, ''],
                hasAttachment: '1',
                status: 0,
                receivedTime: '1700000000000',
              },
            }
          if (path.endsWith('/content'))
            return {
              data: {
                content:
                  '<img src="cid:logo[1]"><img src="/mail/ImageDisplay?cid=other&amp;f=other.png">',
              },
            }
          return {
            data: {
              attachments: [
                {
                  attachmentId: 5,
                  attachmentName: 'File.pdf',
                  attachmentSize: 4,
                },
                { attachmentId: '' },
              ],
              inline: [
                { attachmentId: 7, cid: 'logo[1]', attachmentName: 'Logo.png' },
                { cid: '' },
              ],
            },
          }
        })
        const r = await detail(request(), params())
        const body = await r.json()
        expect(body.message).toMatchObject({
          messageId: '9007199254740993123',
          fromAddress: { displayName: 'Ana', emailAddress: 'ana@example.test' },
          toAddress: [{ displayName: 'Bob', emailAddress: 'bob@example.test' }],
          receivedTime: 1700000000000,
          isRead: false,
          attachments: [{ attachmentId: '5', fileName: 'File.pdf', size: 4 }],
        })
        expect(body.message.content).toBe(body.message.htmlContent)
        expect(body.message.content).toContain(
          'contentId=logo%5B1%5D&fileName=Logo.png'
        )
        expect(body.message.content).toContain(
          'contentId=other&fileName=other.png'
        )
        expect(body.message.content).not.toContain('cid:')
        expect(mocks.mail).toHaveBeenCalledWith(
          'local-token',
          '/accounts/account-a/folders/inbox/messages/message-a/attachmentinfo',
          { searchParams: { includeInline: 'true' } }
        )
      })
      it('keeps message content when attachment metadata fails', async () => {
        mocks.mail.mockImplementation(async (_token, path) => {
          if (path.endsWith('/details'))
            return { data: { hasAttachment: true } }
          if (path.endsWith('/content'))
            return { data: { htmlContent: 'Mail body' } }
          throw new Error('metadata unavailable')
        })
        expect(
          (await (await detail(request(), params())).json()).message
        ).toMatchObject({ content: 'Mail body', attachments: [] })
      })
      it('rejects invalid detail metadata as 502', async () => {
        mocks.mail.mockResolvedValue({ data: 'invalid' })
        const r = await detail(request(), params())
        expect(r.status).toBe(502)
        expect(await r.json()).toEqual({
          error: 'Metadata inválida retornada pela Zoho Mail API',
        })
      })
      it.each([
        ['attachment', attachment],
        ['inline', inline],
      ] as const)(
        '%s preserves binary bytes and isolation headers',
        async (name, run) => {
          const r = await run(
            request(
              'accountId=account-a&folderId=inbox&contentId=logo&filename=%C3%A1%20File.pdf'
            ),
            params()
          )
          expect(r.status).toBe(200)
          expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([
            0, 127, 255,
          ])
          expect(r.headers.get('content-type')).toBe('image/png')
          expect(r.headers.get('cache-control')).toBe('private, no-store')
          expect(r.headers.get('content-security-policy')).toBe(
            "sandbox; default-src 'none'"
          )
          expect(r.headers.get('x-content-type-options')).toBe('nosniff')
          if (name === 'attachment')
            expect(r.headers.get('content-disposition')).toBe(
              'attachment; filename="__File.pdf"'
            )
          else expect(r.headers.get('content-length')).toBe('3')
          expect(mocks.fetch.mock.calls[0]![1]).toMatchObject({
            method: 'GET',
            redirect: 'error',
            signal: expect.any(AbortSignal),
            headers: { Authorization: 'Zoho-oauthtoken local-token' },
          })
        }
      )
      it.each([
        ['attachment', attachment, 'provider denied'],
        ['inline', inline, 'Erro ao buscar imagem inline'],
      ] as const)(
        '%s retains upstream status and its error policy',
        async (_name, run, error) => {
          mocks.fetch.mockResolvedValue(
            new Response('provider denied', { status: 429 })
          )
          const r = await run(request(), params())
          expect(r.status).toBe(429)
          expect(await r.json()).toEqual({ error })
        }
      )
    })
  }
)
