import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { state, database } = vi.hoisted(() => {
  const database = {
    user: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    authSession: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  }
  const state = {
    pending: [] as Array<() => Promise<void>>,
    effects: [] as string[],
    find: vi.fn(),
    count: vi.fn(),
    notice: vi.fn(),
    clear: vi.fn(),
    hash: vi.fn(),
    send: vi.fn(),
    signup: vi.fn(),
    requestReset: vi.fn(),
    reset: vi.fn(),
    identityHandler: vi.fn(),
  }
  return { state, database }
})
vi.mock('../../apps/services/api/src/host/session', () => ({
  getIdentity: async () => ({
    api: {
      signUpEmail: state.signup,
      requestPasswordReset: state.requestReset,
      resetPassword: state.reset,
    },
  }),
  handleIdentityRequest: state.identityHandler,
  findAccountsByEmail: state.find,
  consumeAccountNotice: state.notice,
  resetAuthAccountAttempts: state.clear,
  refuseAuthAttempt: state.count,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  // These legacy-flow cases do not invoke the separate owner HTTP composition.
  // Its real behavior is covered in owner-account.test.ts and owner-account-routes.test.ts.
  createOwnerAccountRuntime: () => ({
    register: vi.fn(),
    read: vi.fn(),
    resend: vi.fn(),
  }),
  getDatabaseRuntime: () => ({ prisma: database }),
  createResendClient: () => ({ emails: { send: state.send } }),
}))
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (task: () => Promise<void>) => {
    state.pending.push(task)
  },
}))
vi.mock('bcryptjs', () => ({ default: { hash: state.hash } }))

import { POST as apiRegister } from '../../apps/services/api/src/app/api/auth/register/route'
import { POST as apiForgot } from '../../apps/services/api/src/app/api/auth/forgot-password/route'
import { POST as apiReset } from '../../apps/services/api/src/app/api/auth/reset-password/route'
import { GET as apiVerify } from '../../apps/services/api/src/app/api/auth/verify-email/route'

const input = {
  name: 'Fixture',
  email: 'Fixture_Account@example.test',
  password: 'fixture-password',
  phone: '41999990000',
  cpf: 'fixture-document',
  cep: '00000000',
}
const email = input.email.toLowerCase()
const token = 'fixture-password-reset-token'
const digest = createHash('sha256').update(token).digest('hex')
const request = (body: unknown = {}, headers: Record<string, string> = {}) =>
  new NextRequest('https://backend.internal/api/auth/account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
const verifyRequest = (query = '') =>
  new NextRequest('https://backend.internal/api/auth/verify-email' + query)
async function flush() {
  while (state.pending.length) await state.pending.shift()!()
}
const registrationResponse = {
  message:
    'Cadastro recebido. Se os dados puderem ser usados, você receberá um email para continuar.',
}
const recoveryResponse = {
  message: 'Se o email existir, você receberá instruções de recuperação.',
}

beforeEach(() => {
  vi.resetAllMocks()
  state.pending.length = 0
  state.effects.length = 0
  vi.stubEnv('AUTH_MODE', 'legacy')
  vi.stubEnv('AUTH_CREDENTIAL_WRITES_PAUSED', '')
  vi.stubEnv('AUTH_V2_ENABLED', '')
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('NEXTAUTH_URL', 'https://app.platform.test')
  vi.stubEnv('FROM_EMAIL', 'fixture@example.test')
  vi.stubEnv('PLATFORM_ENV', 'staging')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'platform.test')
  vi.stubEnv(
    'PLATFORM_EDGE_SECRET',
    'fixture-account-edge-secret-with-32-characters'
  )
  state.count.mockImplementation(async () => {
    state.effects.push('limit')
    return null
  })
  state.find.mockImplementation(async () => {
    state.effects.push('find')
    return []
  })
  state.hash.mockImplementation(async () => {
    state.effects.push('hash')
    return 'new-password-hash'
  })
  state.notice.mockResolvedValue(true)
  state.clear.mockResolvedValue(undefined)
  state.signup.mockResolvedValue(Response.json({ ok: true }))
  state.requestReset.mockResolvedValue(Response.json({ ok: true }))
  state.reset.mockResolvedValue(Response.json({ ok: true }))
  state.identityHandler.mockResolvedValue(Response.json({ ok: true }))
  database.user.create.mockResolvedValue({ email })
  database.user.findUnique.mockResolvedValue({ id: 'account', email })
  database.verificationToken.findUnique.mockResolvedValue({
    token: digest,
    identifier: 'password-reset:' + email,
    expires: new Date(Date.now() + 60_000),
  })
  database.verificationToken.deleteMany.mockResolvedValue({ count: 1 })
  database.verificationToken.create.mockResolvedValue({})
  database.user.update.mockResolvedValue({})
  database.authSession.deleteMany.mockResolvedValue({ count: 1 })
  database.$transaction.mockImplementation(async (job: unknown) => {
    state.effects.push('transaction')
    return typeof job === 'function'
      ? job(database)
      : Promise.all(job as Promise<unknown>[])
  })
  state.send.mockResolvedValue({ data: { id: 'message' } })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe.each([
  ['service host', apiRegister, apiForgot, apiReset, apiVerify],
] as const)(
  '%s credential contracts',
  (_host, register, forgot, reset, verify) => {
    it.each([register, forgot, reset])(
      'refuses a sibling origin before parsing, counting or data %#',
      async (handler) => {
        const response = await handler(
          request('{', {
            'x-platform-edge-auth':
              'fixture-account-edge-secret-with-32-characters',
            'x-platform-host-kind': 'tenant',
            'x-platform-tenant-slug': 'alfa',
            'x-platform-origin': 'https://alfa.platform.test',
            Origin: 'https://bravo.platform.test',
            'Sec-Fetch-Site': 'same-site',
          })
        )
        expect(response.status).toBe(403)
        expect(state.effects).toEqual([])
        expect(state.pending).toEqual([])
        expect(database.verificationToken.findUnique).not.toHaveBeenCalled()
      }
    )
    it.each([register, forgot, reset])(
      'maintenance refuses before parsing or effects %#',
      async (handler) => {
        vi.stubEnv('AUTH_CREDENTIAL_WRITES_PAUSED', 'true')
        const response = await handler(request('{'))
        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({
          error: 'Credential maintenance in progress',
        })
        expect(state.effects).toEqual([])
      }
    )
    it('verification maintenance returns JSON rather than redirect or engine', async () => {
      vi.stubEnv('AUTH_CREDENTIAL_WRITES_PAUSED', 'true')
      const response = await verify(verifyRequest('?token=fixture'))
      expect(response.status).toBe(503)
      expect(state.identityHandler).not.toHaveBeenCalled()
      expect(database.verificationToken.findUnique).not.toHaveBeenCalled()
    })
    it.each([register, forgot, reset])(
      'malformed JSON keeps the generic 500 %#',
      async (handler) => {
        const response = await handler(request('{'))
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro interno do servidor',
        })
        expect(state.effects).toEqual([])
      }
    )
    it('registration normalizes input, hashes before lookup and atomically creates token', async () => {
      const response = await register(
        request({
          ...input,
          email: ' ' + input.email + ' ',
          role: 'ADMIN',
          tenantId: 'foreign',
        })
      )
      expect(response.status).toBe(202)
      expect(await response.json()).toEqual(registrationResponse)
      expect(state.effects).toEqual(['limit', 'hash', 'find', 'transaction'])
      expect(state.hash).toHaveBeenCalledWith(input.password, 12)
      expect(state.find).toHaveBeenCalledWith(email)
      expect(database.user.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          email,
          password: 'new-password-hash',
          phone: input.phone,
          cpf: input.cpf,
          cnpj: undefined,
        },
        select: { email: true },
      })
      expect(database.verificationToken.create).toHaveBeenCalledWith({
        data: {
          identifier: 'email-verification:' + email,
          token: expect.stringMatching(/^[a-f0-9-]{36}$/),
          expires: expect.any(Date),
        },
      })
      const expiry =
        database.verificationToken.create.mock.calls[0]![0].data.expires.getTime()
      expect(expiry - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000)
      expect(state.pending).toEqual([])
    })
    it('registration of an existing account keeps the same response and pays the hash', async () => {
      state.find.mockImplementation(async () => {
        state.effects.push('find')
        return [{ email }]
      })
      const response = await register(request(input))
      expect(response.status).toBe(202)
      expect(await response.json()).toEqual(registrationResponse)
      expect(state.effects).toEqual(['limit', 'hash', 'find'])
      expect(database.$transaction).not.toHaveBeenCalled()
    })
    it('unique conflicts stay neutral; unrelated SQL failure remains generic 500', async () => {
      database.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('private', {
          code: 'P2002',
          clientVersion: 'fixture',
        })
      )
      expect(await (await register(request(input))).json()).toEqual(
        registrationResponse
      )
      database.$transaction.mockRejectedValue(new Error('private SQL'))
      const response = await register(request(input))
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro interno do servidor',
      })
    })
    it.each([429, 503])(
      'register/recovery pass limiter %s unchanged before any operation',
      async (status) => {
        for (const [handler, body] of [
          [register, input],
          [forgot, { email }],
        ] as const) {
          const refused = Response.json(
            { error: 'budget' },
            { status, headers: { 'Retry-After': '60' } }
          )
          state.count.mockResolvedValue(refused)
          expect(await handler(request(body))).toBe(refused)
          expect(state.hash).not.toHaveBeenCalled()
          expect(state.find).not.toHaveBeenCalled()
          expect(state.pending).toEqual([])
        }
      }
    )
    it.each(['register', 'forgot'])(
      '%s invalid input fails before budget',
      async (flow) => {
        const response = await (flow === 'register'
          ? register(request({ ...input, cpf: undefined, cnpj: undefined }))
          : forgot(request({ email: 'invalid' })))
        expect(response.status).toBe(400)
        expect(state.count).not.toHaveBeenCalled()
        expect(database.$transaction).not.toHaveBeenCalled()
      }
    )
    it('legacy verification delivery stays deferred and uses the existing URL and subject', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const response = await register(request(input))
      expect(response.status).toBe(202)
      expect(state.send).not.toHaveBeenCalled()
      expect(state.pending).toHaveLength(1)
      await flush()
      const sent = state.send.mock.calls[0]![0]
      expect(sent.to).toBe(email)
      expect(sent.subject).toContain('Verifique seu email')
      expect(sent.html).toContain(
        'https://app.platform.test/api/auth/verify-email?token='
      )
    })
    it('Better Auth registration responds before the engine and remains neutral on refusal', async () => {
      vi.stubEnv('AUTH_MODE', 'better-auth')
      state.signup.mockResolvedValue(
        Response.json({ error: 'private' }, { status: 422 })
      )
      const req = request(input)
      const response = await register(req)
      expect(response.status).toBe(202)
      expect(await response.json()).toEqual(registrationResponse)
      expect(state.signup).not.toHaveBeenCalled()
      expect(state.find).not.toHaveBeenCalled()
      await flush()
      expect(state.signup).toHaveBeenCalledWith({
        body: { ...input, email },
        headers: req.headers,
        request: req,
        asResponse: true,
      })
      expect(database.user.create).not.toHaveBeenCalled()
    })
    it('Better Auth overlong password refuses after the attempt budget but before engine', async () => {
      vi.stubEnv('AUTH_MODE', 'better-auth')
      const response = await register(
        request({ ...input, password: 'x'.repeat(1025) })
      )
      expect(response.status).toBe(400)
      expect(state.count).toHaveBeenCalledOnce()
      expect(state.pending).toEqual([])
    })
    it('recovery responds neutrally before lookup and stores only the token digest', async () => {
      state.find.mockResolvedValue([{ id: 'account', email }])
      const response = await forgot(request({ email: ' ' + input.email + ' ' }))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(recoveryResponse)
      expect(state.find).not.toHaveBeenCalled()
      expect(state.pending).toHaveLength(1)
      await flush()
      const record = database.verificationToken.create.mock.calls[0]![0].data
      expect(record.token).toMatch(/^[a-f0-9]{64}$/)
      expect(record.identifier).toBe('password-reset:' + email)
      expect(database.verificationToken.deleteMany).toHaveBeenCalledWith({
        where: { identifier: 'password-reset:' + email },
      })
      const html = state.send.mock.calls[0]![0].html as string
      const raw = new URL(html.match(/href="([^"]+)"/)![1]!).searchParams.get(
        'token'
      )!
      expect(createHash('sha256').update(raw).digest('hex')).toBe(record.token)
      expect(record.token).not.toBe(raw)
      expect(record.expires.getTime() - Date.now()).toBeGreaterThan(
        59 * 60 * 1000
      )
    })
    it.each([{ holders: [] }, { holders: [{ email }, { email }] }])(
      'recovery unknown/ambiguous account sends nothing %#',
      async ({ holders }) => {
        state.find.mockResolvedValue(holders)
        expect((await forgot(request({ email }))).status).toBe(200)
        await flush()
        expect(database.$transaction).not.toHaveBeenCalled()
        expect(state.send).not.toHaveBeenCalled()
      }
    )
    it('silent notice exhaustion keeps the old token and same response', async () => {
      state.find.mockResolvedValue([{ email }])
      state.notice.mockResolvedValue(false)
      expect(await (await forgot(request({ email }))).json()).toEqual(
        recoveryResponse
      )
      await flush()
      expect(database.verificationToken.deleteMany).not.toHaveBeenCalled()
      expect(state.send).not.toHaveBeenCalled()
    })
    it('Better Auth recovery forwards the real request only after the neutral response', async () => {
      vi.stubEnv('AUTH_MODE', 'better-auth')
      const req = request({ email })
      expect(await (await forgot(req)).json()).toEqual(recoveryResponse)
      expect(state.requestReset).not.toHaveBeenCalled()
      await flush()
      expect(state.notice).toHaveBeenCalledWith('password-reset', email)
      expect(state.requestReset).toHaveBeenCalledWith({
        body: { email, redirectTo: '/reset-password' },
        headers: req.headers,
        request: req,
        asResponse: true,
      })
      expect(database.verificationToken.create).not.toHaveBeenCalled()
    })
    it('legacy reset consumes exactly one digest, changes the password and invalidates other links/sessions', async () => {
      vi.stubEnv('AUTH_V2_ENABLED', 'true')
      const response = await reset(request({ token, password: input.password }))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        message: 'Senha redefinida com sucesso',
      })
      expect(database.verificationToken.findUnique).toHaveBeenCalledWith({
        where: { token: digest },
      })
      expect(database.verificationToken.deleteMany).toHaveBeenNthCalledWith(1, {
        where: {
          token: digest,
          identifier: 'password-reset:' + email,
          expires: { gt: expect.any(Date) },
        },
      })
      expect(database.verificationToken.deleteMany).toHaveBeenNthCalledWith(2, {
        where: { identifier: 'password-reset:' + email },
      })
      expect(database.user.update).toHaveBeenCalledWith({
        where: { id: 'account' },
        data: { password: 'new-password-hash' },
      })
      expect(database.authSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'account' },
      })
      expect(state.clear).toHaveBeenCalledWith('sign-in', email)
    })
    it.each([
      null,
      {
        identifier: 'email-verification:' + email,
        expires: new Date(Date.now() + 60_000),
      },
      { identifier: 'password-reset:' + email, expires: new Date(0) },
    ])(
      'reset invalid/expired/wrong-purpose token does not hash or write %#',
      async (record) => {
        database.verificationToken.findUnique.mockResolvedValue(record)
        expect(
          (await reset(request({ token, password: input.password }))).status
        ).toBe(400)
        expect(state.hash).not.toHaveBeenCalled()
        expect(database.$transaction).not.toHaveBeenCalled()
      }
    )
    it('a concurrently consumed reset token cannot change password or clear attempts', async () => {
      database.verificationToken.deleteMany.mockResolvedValue({ count: 0 })
      expect(
        (await reset(request({ token, password: input.password }))).status
      ).toBe(400)
      expect(database.user.update).not.toHaveBeenCalled()
      expect(state.clear).not.toHaveBeenCalled()
    })
    it('reset with missing account preserves 404', async () => {
      database.user.findUnique.mockResolvedValue(null)
      const response = await reset(request({ token, password: input.password }))
      expect(response.status).toBe(404)
      expect(database.$transaction).not.toHaveBeenCalled()
    })
    it('Better Auth reset forwards engine refusal unchanged and translates only success', async () => {
      vi.stubEnv('AUTH_MODE', 'better-auth')
      const refused = Response.json({ error: 'TOKEN_EXPIRED' }, { status: 400 })
      state.reset.mockResolvedValue(refused)
      expect(await reset(request({ token, password: input.password }))).toBe(
        refused
      )
      expect(database.verificationToken.findUnique).not.toHaveBeenCalled()
      state.reset.mockResolvedValue(Response.json({ ok: true }))
      expect(
        await (await reset(request({ token, password: input.password }))).json()
      ).toEqual({ message: 'Senha redefinida com sucesso' })
    })
    it('legacy verification missing/expired links preserve 307 and request origin', async () => {
      const absent = await verify(verifyRequest())
      expect(absent.status).toBe(307)
      expect(absent.headers.get('location')).toBe(
        'https://backend.internal/login?error=token-missing'
      )
      database.verificationToken.findUnique.mockResolvedValue(null)
      const expired = await verify(verifyRequest('?token=fixture'))
      expect(expired.status).toBe(307)
      expect(expired.headers.get('location')).toBe(
        'https://backend.internal/login?error=token-expired'
      )
    })
    it('legacy verification consumes token before marking both identity fields', async () => {
      vi.stubEnv('AUTH_V2_ENABLED', 'true')
      database.verificationToken.findUnique.mockResolvedValue({
        identifier: 'email-verification:' + email,
        expires: new Date(Date.now() + 60_000),
      })
      const response = await verify(verifyRequest('?token=fixture'))
      expect(response.headers.get('location')).toBe(
        'https://backend.internal/login?verified=true'
      )
      expect(database.user.update).toHaveBeenCalledWith({
        where: { email },
        data: { emailVerified: expect.any(Date), authEmailVerified: true },
      })
      database.verificationToken.deleteMany.mockResolvedValue({ count: 0 })
      database.user.update.mockClear()
      expect(
        (await verify(verifyRequest('?token=fixture'))).headers.get('location')
      ).toContain('token-expired')
      expect(database.user.update).not.toHaveBeenCalled()
    })
    it('verification transaction failure preserves the neutral failure redirect', async () => {
      database.verificationToken.findUnique.mockResolvedValue({
        identifier: 'email-verification:' + email,
        expires: new Date(Date.now() + 60_000),
      })
      database.$transaction.mockRejectedValue(new Error('private SQL'))
      expect(
        (await verify(verifyRequest('?token=fixture'))).headers.get('location')
      ).toBe('https://backend.internal/login?error=verification-failed')
    })
    it('Better Auth verification delegates the original request without legacy lookup', async () => {
      vi.stubEnv('AUTH_MODE', 'better-auth')
      const req = verifyRequest('?token=fixture')
      const response = await verify(req)
      expect(response).toBe(await state.identityHandler.mock.results[0]!.value)
      expect(state.identityHandler).toHaveBeenCalledWith(req)
      expect(database.verificationToken.findUnique).not.toHaveBeenCalled()
    })
  }
)
