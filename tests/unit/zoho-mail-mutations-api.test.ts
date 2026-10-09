import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { TenantTransactionRunner } from '@gb-locacoes/backend/rentals'
import {
  createZohoMailSender,
  createZohoMailReplier,
  createZohoMailDraftWriter,
  createZohoMailUpdater,
  createZohoMailDeleter,
  createZohoMailAttachmentUploader,
} from '@gb-locacoes/backend/http'
const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  token: vi.fn(),
  account: vi.fn(),
  mail: vi.fn(),
  upload: vi.fn(),
  limit: vi.fn(),
  cache: vi.fn(),
  store: vi.fn(),
  audit: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  transaction: vi.fn(),
}))
vi.mock('@/middlewares/require-admin', () => ({
  requireAdminOrOperator: mocks.gate,
}))
vi.mock('@/lib/zoho-mail/get-access-token', () => ({
  getZohoAccountId: mocks.account,
}))
vi.mock('@/lib/zoho-mail', async () => ({
  getZohoAccessToken: mocks.token,
  getZohoAccountId: mocks.account,
  makeZohoMailRequest: mocks.mail,
  uploadZohoMailAttachments: mocks.upload,
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.limit,
  strictRateLimit: 'strict',
  adminApiRateLimit: 'admin',
}))
vi.mock('@/lib/idempotency', () => ({
  checkIdempotency: mocks.cache,
  storeIdempotency: mocks.store,
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: mocks.info, error: mocks.error },
}))
vi.mock('@/lib/tenant', () => ({
  withTenantTransaction: async (
    _context: unknown,
    fn: (_tx: unknown) => Promise<unknown>
  ) => mocks.transaction(fn),
}))
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  ...(await (async () => {
    const F = await (() => ({
      logger: { info: mocks.info, error: mocks.error },
    }))()
    return { createApplicationLogger: () => F.logger }
  })()),
}))
vi.mock('../../apps/services/api/src/host/rate-limit', () => ({
  checkRateLimit: mocks.limit,
  strictRateLimit: 'strict',
  adminApiRateLimit: 'admin',
}))
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
      const F = await (async () => ({
        getZohoAccessToken: mocks.token,
        getZohoAccountId: mocks.account,
        makeZohoMailRequest: mocks.mail,
        uploadZohoMailAttachments: mocks.upload,
      }))()
      Object.assign(sharedTokens, F)
      return {
        createZohoMailClient: () => F,
        createZohoMailTokenReader: () => Object.assign(sharedTokens, F),
      }
    })()),
  }
})
vi.mock('@gb-locacoes/backend/http', async (importOriginal) => {
  const sharedTokens: Record<string, unknown> = {}
  void sharedTokens
  return {
    ...(await importOriginal<typeof import('@gb-locacoes/backend/http')>()),
    ...(await (async () => {
      const F = await (() => ({
        checkIdempotency: mocks.cache,
        storeIdempotency: mocks.store,
      }))()
      return {
        createMemoryIdempotencyCache: () => ({
          checkIdempotency: F.checkIdempotency,
          storeIdempotency: F.storeIdempotency,
        }),
      }
    })()),
  }
})
vi.mock(
  '../../apps/services/api/src/host/tenant-transaction',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/tenant-transaction')
    >()),
    ...(await (() => ({
      withTenantTransaction: async (
        _context: unknown,
        fn: (_tx: unknown) => Promise<unknown>
      ) => mocks.transaction(fn),
    }))()),
  })
)
import * as legacyRoute0 from '@/app/api/admin/zoho-mail/messages/send/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/zoho-mail/messages/send/route'
import * as legacyRoute1 from '@/app/api/admin/zoho-mail/messages/[messageId]/reply/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/zoho-mail/messages/[messageId]/reply/route'
import * as legacyRoute2 from '@/app/api/admin/zoho-mail/messages/drafts/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/zoho-mail/messages/drafts/route'
import * as legacyRoute3 from '@/app/api/admin/zoho-mail/messages/update/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/zoho-mail/messages/update/route'
import * as legacyRoute4 from '@/app/api/admin/zoho-mail/messages/[messageId]/delete/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/zoho-mail/messages/[messageId]/delete/route'
import * as legacyRoute5 from '@/app/api/admin/zoho-mail/attachments/upload/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/admin/zoho-mail/attachments/upload/route'

const HOSTS = [
  [
    'legacy root',
    {
      send: legacyRoute0.POST,
      reply: legacyRoute1.POST,
      draft: legacyRoute2.POST,
      update: legacyRoute3.PUT,
      remove: legacyRoute4.DELETE,
      upload: legacyRoute5.POST,
    },
  ],
  [
    'service',
    {
      send: serviceRoute0.POST,
      reply: serviceRoute1.POST,
      draft: serviceRoute2.POST,
      update: serviceRoute3.PUT,
      remove: serviceRoute4.DELETE,
      upload: serviceRoute5.POST,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (host, { send, reply, draft, update, remove, upload }) => {
    const principal = { tenantId: 'alfa', userId: 'operator', role: 'OPERATOR' }
    const body = {
      fromAddress: 'from@example.test',
      toAddress: 'to@example.test',
      ccAddress: '',
      bccAddress: '',
      subject: ' Mail ',
      content: '<b>Hi & bye</b>\nNext',
    }
    const params = () => ({
      params: Promise.resolve({ messageId: '9007199254740993125' }),
    })
    function request(
      value: unknown = body,
      method = 'POST',
      query = '',
      headers: Record<string, string> = {}
    ) {
      return new NextRequest('http://localhost/api?' + query, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(value),
      })
    }
    function multipart(files: File[] = [new File(['hi'], 'mail.txt')]) {
      const form = new FormData()
      for (const file of files) form.append('files', file)
      return new NextRequest('http://localhost/api', {
        method: 'POST',
        body: form,
      })
    }
    const cases = [
      { name: 'send', run: () => send(request()), limited: true },
      { name: 'reply', run: () => reply(request(), params()), limited: true },
      {
        name: 'draft',
        run: () =>
          draft(
            request({
              fromAddress: body.fromAddress,
              toAddress: '',
              ccAddress: '',
              bccAddress: '',
              draftFolderId: 'drafts',
            })
          ),
        limited: true,
      },
      {
        name: 'update',
        run: () =>
          update(request({ action: 'read', messageIds: ['123'] }, 'PUT')),
        limited: false,
      },
      {
        name: 'delete',
        run: () =>
          remove(
            request(undefined, 'DELETE', 'accountId=account-a&folderId=inbox'),
            params()
          ),
        limited: false,
      },
      { name: 'upload', run: () => upload(multipart()), limited: true },
    ]
    beforeEach(() => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
      vi.resetAllMocks()
      mocks.transaction.mockImplementation((fn) =>
        fn({ auditLog: { create: mocks.audit } })
      )
      mocks.gate.mockResolvedValue({
        success: true,
        principal,
        tenantId: principal.tenantId,
        user: { id: principal.userId },
      })
      mocks.token.mockResolvedValue('local-token')
      mocks.account.mockResolvedValue('account-a')
      mocks.limit.mockReturnValue({ allowed: true })
      mocks.cache.mockReturnValue(null)
      mocks.mail.mockResolvedValue({
        status: { code: 200 },
        data: { messageId: 'new-draft' },
      })
      mocks.upload.mockResolvedValue([
        {
          storeName: 'local',
          attachmentName: 'mail.txt',
          attachmentPath: 'local/mail.txt',
          fileName: 'mail.txt',
          size: 2,
        },
      ])
    })
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllEnvs()
    })
    describe('shared Zoho mutation admission and private HTTP parity', () => {
      const serviceCases = () => {
        const withTenantTransaction: TenantTransactionRunner = (_scope, fn) =>
          mocks.transaction(fn)
        const ports = {
          getZohoAccessToken: mocks.token,
          getZohoAccountId: mocks.account,
          makeZohoMailRequest: mocks.mail,
          uploadZohoMailAttachments: mocks.upload,
          checkRateLimit: mocks.limit,
          strictRateLimit: { maxRequests: 1, windowMs: 1 },
          adminApiRateLimit: { maxRequests: 1, windowMs: 1 },
          checkIdempotency: mocks.cache,
          storeIdempotency: mocks.store,
          withTenantTransaction,
          logger: { info: mocks.info, error: mocks.error },
        }
        return [
          () =>
            createZohoMailSender(ports).sendMessage(
              principal,
              principal.userId,
              request()
            ),
          () =>
            createZohoMailReplier(ports).replyMessage(
              principal,
              principal.userId,
              request(),
              params()
            ),
          () =>
            createZohoMailDraftWriter(ports).saveDraft(
              principal,
              principal.userId,
              request({
                fromAddress: body.fromAddress,
                toAddress: '',
                ccAddress: '',
                bccAddress: '',
                draftFolderId: 'drafts',
              })
            ),
          () =>
            createZohoMailUpdater(ports).updateMessages(
              principal,
              principal.userId,
              request({ action: 'read', messageIds: ['123'] }, 'PUT')
            ),
          () =>
            createZohoMailDeleter(ports).deleteMessage(
              principal,
              principal.userId,
              request(
                undefined,
                'DELETE',
                'accountId=account-a&folderId=inbox'
              ),
              params()
            ),
          () =>
            createZohoMailAttachmentUploader(ports).uploadAttachments(
              principal,
              principal.userId,
              multipart()
            ),
        ]
      }
      it.each(
        cases.flatMap((entry, index) =>
          ['SETUP', 'RESTRICTED', 'ARCHIVED'].map((access) => ({
            ...entry,
            index,
            access,
          }))
        )
      )(
        '$name preserves policy DTO and headers in both adapters when access is $access',
        async ({ run, index, access }) => {
          vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
          mocks.cache.mockReturnValue({ success: true })
          mocks.transaction.mockImplementation((fn) =>
            fn({
              $queryRaw: async () => [{ id: 'alfa', status: 'ACTIVE', access }],
            })
          )
          const legacy = await run(),
            service = await serviceCases()[index]!()
          expect(service.status).toBe(legacy.status)
          expect(service.status).toBe(access === 'ARCHIVED' ? 403 : 402)
          expect(await service.json()).toEqual(await legacy.json())
          for (const response of [legacy, service]) {
            expect(response.headers.get('Cache-Control')).toBe(
              'private, no-store'
            )
            expect(response.headers.get('Vary')).toBe('Cookie, Host')
          }
          expect(mocks.mail).not.toHaveBeenCalled()
          expect(mocks.upload).not.toHaveBeenCalled()
          expect(mocks.cache).not.toHaveBeenCalled()
          expect(mocks.store).not.toHaveBeenCalled()
          expect(mocks.audit).not.toHaveBeenCalled()
        }
      )
      it.each(cases)(
        '$name fails closed for invalid enforcement before external mutation',
        async ({ run }) => {
          vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'invalid')
          expect((await run()).status).toBe(503)
          expect(mocks.transaction).not.toHaveBeenCalled()
          expect(mocks.mail).not.toHaveBeenCalled()
          expect(mocks.upload).not.toHaveBeenCalled()
        }
      )
    })
    describe('Zoho mutation legacy characterization', () => {
      it.each(cases)(
        '$name refuses before limiter, SQL and provider',
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
            mocks.limit,
            mocks.token,
            mocks.mail,
            mocks.upload,
            mocks.audit,
          ])
            expect(port).not.toHaveBeenCalled()
        }
      )
      // Só o contrato do require-admin da raiz admite "sucesso sem usuário"; o principal do serviço
      // (resolveTenantPrincipal) sempre traz o userId, então o caso não existe nele.
      it.runIf(host === 'legacy root').each(cases)(
        '$name preserves missing user',
        async ({ run }) => {
          mocks.gate.mockResolvedValue({ success: true, principal, user: {} })
          const r = await run()
          expect(r.status).toBe(401)
          expect(await r.json()).toEqual({ error: 'Usuário não identificado' })
          expect(mocks.token).not.toHaveBeenCalled()
        }
      )
      it.each(cases.filter((c) => c.limited))(
        '$name keeps rate refusal ahead of cache and token',
        async ({ run }) => {
          mocks.limit.mockReturnValue({
            allowed: false,
            response: Response.json(
              { error: 'limited' },
              { status: 429, headers: { 'Retry-After': '60' } }
            ),
          })
          const r = await run()
          expect(r.status).toBe(429)
          expect(r.headers.get('retry-after')).toBe('60')
          expect(mocks.token).not.toHaveBeenCalled()
          expect(mocks.cache).not.toHaveBeenCalled()
        }
      )
      it.each(cases)(
        '$name uses current principal for token access',
        async ({ run }) => {
          await run()
          expect(mocks.token).toHaveBeenCalledWith(principal, principal.userId)
        }
      )
      it.each(cases)(
        '$name preserves disconnected refusal without provider work',
        async ({ run }) => {
          mocks.token.mockResolvedValue(null)
          expect((await run()).status).toBe(401)
          expect(mocks.mail).not.toHaveBeenCalled()
          expect(mocks.upload).not.toHaveBeenCalled()
        }
      )
      it.each(cases)(
        '$name preserves provider error envelope',
        async ({ run }) => {
          mocks.mail.mockRejectedValue(new Error('local provider failed'))
          mocks.upload.mockRejectedValue(new Error('local provider failed'))
          const r = await run()
          expect(r.status).toBe(500)
          expect(await r.json()).toEqual({ error: 'local provider failed' })
        }
      )
      it.each([
        ['send', send],
        ['reply', (r: NextRequest) => reply(r, params())],
      ] as const)(
        '%s uses scoped cached result before token or body',
        async (name, run) => {
          mocks.cache.mockReturnValue({ success: true, cached: 'fixture' })
          const r = await run(
            request({}, 'POST', '', { 'x-idempotency-key': 'retry' })
          )
          expect(await r.json()).toEqual({ success: true, cached: 'fixture' })
          expect(mocks.cache).toHaveBeenCalledWith(
            `alfa:operator:app/api/admin/zoho-mail/messages/${name === 'send' ? 'send' : '[messageId]/reply'}/route.ts:retry`
          )
          expect(mocks.token).not.toHaveBeenCalled()
          expect(mocks.audit).not.toHaveBeenCalled()
        }
      )
      it('sends escaped HTML, normalized headers and attachments then caches before auditing', async () => {
        const attachments = [
          {
            storeName: 'box',
            attachmentName: 'mail.txt',
            attachmentPath: 'box/mail.txt',
          },
        ]
        const r = await send(
          request(
            {
              ...body,
              ccAddress: ' cc@example.test ',
              bccAddress: '',
              attachments,
              unknown: 'ignored',
            },
            'POST',
            '',
            { 'x-idempotency-key': 'retry' }
          )
        )
        expect(await r.json()).toEqual({ success: true })
        expect(mocks.mail).toHaveBeenCalledWith(
          'local-token',
          '/accounts/account-a/messages',
          {
            method: 'POST',
            body: {
              fromAddress: body.fromAddress,
              toAddress: body.toAddress,
              subject: 'Mail',
              content: '&lt;b&gt;Hi &amp; bye&lt;/b&gt;<br>\nNext',
              mailFormat: 'html',
              ccAddress: 'cc@example.test',
              attachments,
            },
          }
        )
        expect(mocks.audit).toHaveBeenCalledWith({
          data: {
            tenantId: 'alfa',
            userId: 'operator',
            action: 'SEND',
            entity: 'EMAIL',
            entityId: 'operator',
          },
        })
        expect(mocks.store.mock.invocationCallOrder[0]).toBeLessThan(
          mocks.audit.mock.invocationCallOrder[0]!
        )
      })
      it('preserves successful provider send followed by audit failure and cached response', async () => {
        mocks.audit.mockRejectedValue(new Error('local audit failed'))
        const r = await send(
          request(body, 'POST', '', { 'x-idempotency-key': 'retry' })
        )
        expect(r.status).toBe(500)
        expect(await r.json()).toEqual({ error: 'local audit failed' })
        expect(mocks.store).toHaveBeenCalledWith(
          'alfa:operator:app/api/admin/zoho-mail/messages/send/route.ts:retry',
          { success: true }
        )
      })
      it('reply retains action, plain text and audited entity', async () => {
        await reply(request({ ...body, mailFormat: 'plaintext' }), params())
        expect(mocks.mail).toHaveBeenCalledWith(
          'local-token',
          '/accounts/account-a/messages/9007199254740993125',
          {
            method: 'POST',
            body: {
              fromAddress: body.fromAddress,
              toAddress: body.toAddress,
              subject: 'Mail',
              content: body.content,
              mailFormat: 'plaintext',
              action: 'Reply',
            },
          }
        )
        expect(mocks.audit.mock.calls[0]![0].data.entityId).toBe(
          '9007199254740993125'
        )
      })
      it.each([send, (r: NextRequest) => reply(r, params()), draft])(
        'retains invalid JSON and Zod error details',
        async (run) => {
          const invalid = new NextRequest('http://localhost/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{',
          })
          const json = await run(invalid)
          expect(json.status).toBe(400)
          expect(await json.json()).toEqual({
            error: 'Corpo da requisição inválido',
          })
          const schema = await run(request({ fromAddress: 'invalid' }))
          expect(schema.status).toBe(400)
          expect((await schema.json()).details).toEqual(
            expect.arrayContaining([
              {
                field: 'fromAddress',
                message: 'Um ou mais endereços de e-mail são inválidos',
              },
            ])
          )
        }
      )
      it.each([
        { data: { messageId: 'new' } },
        { data: [{ messageId: 'new' }] },
        { messageId: 'new' },
        {},
      ])(
        'draft handles ID envelope %j and best-effort deletes prior draft',
        async (result) => {
          mocks.mail.mockImplementation(async (_token, _path, options) => {
            if (options.method === 'DELETE')
              throw new Error('cannot remove old')
            return result
          })
          const r = await draft(
            request({
              fromAddress: body.fromAddress,
              toAddress: '',
              ccAddress: '',
              bccAddress: '',
              draftFolderId: ' drafts ',
              draftMessageId: ' old ',
              subject: ' ',
              content: '',
            })
          )
          expect(await r.json()).toEqual({
            success: true,
            draftId: Object.keys(result).length ? 'new' : null,
          })
          expect(mocks.mail.mock.calls[0]![2].body).toEqual({
            fromAddress: body.fromAddress,
            content: '',
            mailFormat: 'html',
          })
          if (Object.keys(result).length)
            expect(mocks.mail.mock.calls[1]![1]).toBe(
              '/accounts/account-a/folders/drafts/messages/old'
            )
        }
      )
      it.each([
        ['archive', 'archiveMails'],
        ['unarchive', 'unArchiveMails'],
        ['read', 'markAsRead'],
        ['unread', 'markAsUnread'],
        ['move', 'moveMessage'],
        ['star', 'setFlag'],
        ['unstar', 'setFlag'],
        ['spam', 'moveToSpam'],
        ['notspam', 'markNotSpam'],
      ])('update retains action %s and raw long IDs', async (action, mode) => {
        await update(
          request(
            {
              action,
              messageIds: ['9007199254740993125', 'bad'],
              threadIds: ['9007199254740993128'],
              targetFolderId: '9007199254740993124',
              sourceFolderId: '9007199254740993123',
              isArchive: true,
              isFolderSpecific: true,
            },
            'PUT'
          )
        )
        const call = mocks.mail.mock.calls[0]!
        expect(call[1]).toBe('/accounts/account-a/updatemessage')
        expect(call[2].body).toContain(`"mode":"${mode}"`)
        expect(call[2].body).toContain('"threadId":[9007199254740993128]')
        expect(call[2].body.includes('"messageId"')).toBe(action === 'move')
        if (action === 'star' || action === 'unstar')
          expect(call[2].body).toContain(
            `"flagid":"${action === 'star' ? 'important' : 'flag_not_set'}"`
          )
      })
      it('update keeps bad action/IDs and embedded provider errors', async () => {
        expect((await update(request({}, 'PUT'))).status).toBe(400)
        expect(
          (
            await update(
              request({ action: 'invalid', messageIds: ['1'] }, 'PUT')
            )
          ).status
        ).toBe(400)
        expect(
          (
            await update(
              request(
                { action: 'move', messageIds: ['1'], targetFolderId: 'abc' },
                'PUT'
              )
            )
          ).status
        ).toBe(400)
        expect(
          (await update(request({ action: 'read', messageIds: ['x'] }, 'PUT')))
            .status
        ).toBe(400)
        mocks.mail.mockResolvedValue({
          status: { code: 400, description: 'embedded provider refusal' },
        })
        const r = await update(
          request({ action: 'read', messageIds: ['1'] }, 'PUT')
        )
        expect(r.status).toBe(400)
        expect(await r.json()).toEqual({ error: 'embedded provider refusal' })
      })
      it('delete checks ownership before token and retains literal expunge=true', async () => {
        mocks.account.mockResolvedValue('foreign')
        expect(
          (
            await remove(
              request({}, 'DELETE', 'accountId=account-a&folderId=inbox'),
              params()
            )
          ).status
        ).toBe(403)
        expect(mocks.token).not.toHaveBeenCalled()
        mocks.account.mockResolvedValue('account-a')
        await remove(
          request(
            {},
            'DELETE',
            'accountId=account-a&folderId=inbox&expunge=true'
          ),
          params()
        )
        expect(mocks.mail).toHaveBeenCalledWith(
          'local-token',
          '/accounts/account-a/folders/inbox/messages/9007199254740993125',
          { method: 'DELETE', searchParams: { expunge: 'true' } }
        )
      })
      it('uploads real files through the existing multipart port and returns its DTO', async () => {
        const r = await upload(multipart())
        expect(await r.json()).toEqual({
          attachments: [
            {
              storeName: 'local',
              attachmentName: 'mail.txt',
              attachmentPath: 'local/mail.txt',
              fileName: 'mail.txt',
              size: 2,
            },
          ],
        })
        expect(mocks.upload.mock.calls[0]![0]).toBe('local-token')
        expect(mocks.upload.mock.calls[0]![1]).toBe('account-a')
        expect(mocks.upload.mock.calls[0]![2][0]).toMatchObject({
          fileName: 'mail.txt',
          size: 2,
          file: expect.any(File),
        })
      })
      it('upload keeps empty/malformed forms, file and total limits before transport', async () => {
        expect((await upload(multipart([]))).status).toBe(400)
        const files = [new File(['a'], 'big.txt')]
        Object.defineProperty(files[0], 'size', { value: 20 * 1024 * 1024 + 1 })
        const r = request()
        Object.defineProperty(r, 'formData', {
          value: async () => ({ getAll: () => files }),
          configurable: true,
        })
        expect((await upload(r)).status).toBe(400)
        const many = Array.from({ length: 3 }, () => {
          const file = new File(['a'], 'file.txt')
          Object.defineProperty(file, 'size', { value: 18 * 1024 * 1024 })
          return file
        })
        Object.defineProperty(r, 'formData', {
          value: async () => ({ getAll: () => many }),
          configurable: true,
        })
        expect((await upload(r)).status).toBe(400)
        expect(mocks.upload).not.toHaveBeenCalled()
      })
    })
  }
)
