const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  const { requireTestDatabase } = await import('../helpers/test-database')
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Disposable database opt-in required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 4,
  })
  fPreparedDatabase.pool = pool
  return {
    prisma: (fixtureDatabase.prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    })),
  }
}
import { getDatabaseRuntime as getFPreparedDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { createHash, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => {
  // The API host's session composition and NextAuth read these when the modules are evaluated.
  process.env.NEXTAUTH_SECRET = 'fixture-legacy-session-secret-identity-tests'
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  return { send: vi.fn() }
})
const fixtureDatabase = vi.hoisted(() => ({ prisma: undefined as unknown }))

import bcrypt from 'bcryptjs'
import NextAuth, { getServerSession, type User } from 'next-auth'
import { decode, type JWT } from 'next-auth/jwt'

import { authOptions as serviceAuthOptions } from '../../apps/services/api/src/host/session'
const { prisma } = getFPreparedDatabaseRuntime()
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade da raiz foi retirada no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => ({ prisma: fixtureDatabase.prisma }),
    ...(await (async () => {
      const F = await (() => ({
        default: () => ({ emails: { send: mocks.send } }),
      }))()
      return { createResendClient: () => F.default() }
    })()),
  }))(importOriginal)
  return {
    ...originalComposition,
    getDatabaseRuntime: () => ({
      prisma: fPreparedDatabase.value!.prisma,
      ...(fPreparedDatabase.pool ? { pool: fPreparedDatabase.pool } : {}),
    }),
  }
})

import * as serviceRoute0 from '../../apps/services/api/src/app/api/auth/forgot-password/route'

import * as serviceRoute1 from '../../apps/services/api/src/app/api/auth/reset-password/route'

import * as serviceRoute2 from '../../apps/services/api/src/app/api/auth/register/route'

const HOSTS = [
  [
    'service',
    {
      authOptions: serviceAuthOptions,
      forgotPassword: serviceRoute0.POST,
      resetPassword: serviceRoute1.POST,
      register: serviceRoute2.POST,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (_host, { authOptions, forgotPassword, resetPassword, register }) => {
    const secret = 'fixture-legacy-session-secret-identity-tests'
    const fixture = randomUUID()
    const email = `legacy-session-${fixture}@example.test`
    const oldPassword = 'fixture-old-password'
    const newPassword = 'fixture-new-password'
    const createdEmails = [email]
    const sessionCookie = 'next-auth.session-token'
    let userId = ''
    let network = 0

    type Jar = Record<string, string>
    const sha256 = (value: string) =>
      createHash('sha256').update(value).digest('hex')

    function fakeResponse() {
      const headers = new Map<string, unknown>()
      const state: { status: number; body: unknown } = {
        status: 200,
        body: null,
      }
      const response = {
        getHeader: (name: string) => headers.get(name.toLowerCase()),
        setHeader: (name: string, value: unknown) => {
          headers.set(name.toLowerCase(), value)
          return response
        },
        status: (code: number) => {
          state.status = code
          return response
        },
        json: (body: unknown) => {
          state.body = body
          return response
        },
        send: (body: unknown) => {
          state.body = body
          return response
        },
        end: () => response,
      }
      const setCookies = () =>
        ([] as string[]).concat((headers.get('set-cookie') as string[]) ?? [])
      return { response, state, setCookies }
    }
    function store(jar: Jar, setCookies: string[]) {
      for (const header of setCookies) {
        const pair = header.split(';')[0]!
        const name = pair.slice(0, pair.indexOf('='))
        const value = decodeURIComponent(pair.slice(pair.indexOf('=') + 1))
        if (!value || /max-age=0/i.test(header)) delete jar[name]
        else jar[name] = value
      }
    }
    // Drives the real NextAuth handler (same core as /api/auth/[...nextauth]).
    async function nextAuth(
      action: string[],
      method: 'GET' | 'POST',
      jar: Jar,
      ip: string,
      body?: Record<string, string>
    ) {
      const { response, state, setCookies } = fakeResponse()
      await NextAuth(
        {
          query: { nextauth: action },
          method,
          body,
          cookies: { ...jar },
          headers: { host: 'localhost:3000', 'x-forwarded-for': ip },
        } as never,
        response as never,
        authOptions
      )
      store(jar, setCookies())
      return state
    }
    // Each call comes from its own /64 unless a client address is given.
    const newClient = () =>
      `2001:db8:${fixture.slice(0, 4)}:${(++network).toString(16)}::1`
    async function signIn(login: string, password: string, ip = newClient()) {
      const jar: Jar = {}
      const csrf = await nextAuth(['csrf'], 'GET', jar, ip)
      const result = await nextAuth(
        ['callback', 'credentials'],
        'POST',
        jar,
        ip,
        {
          email: login,
          password,
          csrfToken: (csrf.body as { csrfToken: string }).csrfToken,
          callbackUrl: 'http://localhost:3000/',
          json: 'true',
        }
      )
      const url = new URL((result.body as { url: string }).url)
      return {
        status: result.status,
        error: url.searchParams.get('error'),
        jar,
      }
    }
    function resolveSession(jar: Jar) {
      const { response } = fakeResponse()
      return getServerSession(
        { headers: { host: 'localhost:3000' }, cookies: { ...jar } } as never,
        response as never,
        authOptions
      )
    }
    function jsonRequest(path: string, body: unknown) {
      return new NextRequest(`http://localhost:3000${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': `198.51.100.${++network % 250}`,
        },
        body: JSON.stringify(body),
      })
    }
    function emailedToken(): string {
      const message = mocks.send.mock.calls.at(-1)![0] as { html: string }
      const link = /href="([^"]+)"/
        .exec(message.html)![1]!
        .replace(/&amp;/g, '&')
      return new URL(link).searchParams.get('token')!
    }

    beforeAll(async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => {
          throw new Error('External network forbidden in identity tests')
        })
      )
      const user = await prisma.user.create({
        data: {
          email,
          name: 'Legacy session fixture',
          role: 'CLIENT',
          password: await bcrypt.hash(oldPassword, 10),
          phone: '11999999999',
          cpf: `cpf-${fixture}`,
        },
      })
      userId = user.id
    })
    beforeEach(() => {
      vi.stubEnv('AUTH_MODE', 'legacy')
      vi.stubEnv('AUTH_V2_ENABLED', 'false')
      vi.stubEnv('AUTH_CREDENTIAL_WRITES_PAUSED', 'false')
      vi.stubEnv('FROM_EMAIL', 'no-reply@example.test')
      vi.stubEnv('PLATFORM_NAME', '')
      mocks.send.mockReset()
      mocks.send.mockResolvedValue({ data: { id: 'email' }, error: null })
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })
    afterAll(async () => {
      await prisma.verificationToken.deleteMany({
        where: {
          OR: createdEmails.flatMap((address) => [
            { identifier: `password-reset:${address}` },
            { identifier: `email-verification:${address}` },
          ]),
        },
      })
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } })
      await prisma.$disconnect()
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    })

    describe('legacy JWT after a password reset (PostgreSQL)', () => {
      it('rejects the JWT issued before the reset and accepts a new sign-in', async () => {
        const before = await signIn(email, oldPassword)
        expect(before).toMatchObject({ status: 200, error: null })
        const oldJar = { ...before.jar }
        expect((await resolveSession(oldJar))?.user).toMatchObject({
          id: userId,
        })

        const decoded = await decode({ token: oldJar[sessionCookie]!, secret })
        const stored = await prisma.user.findUniqueOrThrow({
          where: { id: userId },
        })
        expect(typeof decoded?.credentialVersion).toBe('string')
        expect(JSON.stringify(decoded)).not.toContain(stored.password!)

        const forgot = await forgotPassword(
          jsonRequest('/api/auth/forgot-password', { email })
        )
        expect(forgot.status).toBe(200)
        const rawToken = emailedToken()
        const rows = await prisma.verificationToken.findMany({
          where: { identifier: `password-reset:${email}` },
        })
        expect(rows).toHaveLength(1)
        expect(rows[0]!.token).toBe(sha256(rawToken))

        const reset = await resetPassword(
          jsonRequest('/api/auth/reset-password', {
            token: rawToken,
            password: newPassword,
          })
        )
        expect(reset.status).toBe(200)

        expect(await resolveSession(oldJar)).toBeNull()
        expect(await signIn(email, oldPassword)).toMatchObject({
          status: 401,
          error: 'CredentialsSignin',
        })
        const after = await signIn(email, newPassword)
        expect(after).toMatchObject({ status: 200, error: null })
        expect((await resolveSession(after.jar))?.user).toMatchObject({
          id: userId,
        })
      })

      it('does not accept a reset link stored in clear text before this change', async () => {
        const legacyToken = randomUUID()
        await prisma.verificationToken.create({
          data: {
            identifier: `password-reset:${email}`,
            token: legacyToken,
            expires: new Date(Date.now() + 60 * 60 * 1000),
          },
        })
        const before = await prisma.user.findUniqueOrThrow({
          where: { id: userId },
        })
        const response = await resetPassword(
          jsonRequest('/api/auth/reset-password', {
            token: legacyToken,
            password: 'fixture-hijacked-password',
          })
        )
        expect(response.status).toBe(400)
        const after = await prisma.user.findUniqueOrThrow({
          where: { id: userId },
        })
        expect(after.password).toBe(before.password)
      })

      it('a stored hash read from the database cannot be replayed as a token', async () => {
        await forgotPassword(
          jsonRequest('/api/auth/forgot-password', { email })
        )
        const [row] = await prisma.verificationToken.findMany({
          where: { identifier: `password-reset:${email}` },
        })
        expect(row).toBeDefined()
        const response = await resetPassword(
          jsonRequest('/api/auth/reset-password', {
            token: row!.token,
            password: 'fixture-hijacked-password',
          })
        )
        expect(response.status).toBe(400)
        // The issued link still works exactly once and clears every reset link.
        const valid = await resetPassword(
          jsonRequest('/api/auth/reset-password', {
            token: emailedToken(),
            password: newPassword,
          })
        )
        expect(valid.status).toBe(200)
        expect(
          await prisma.verificationToken.count({
            where: { identifier: `password-reset:${email}` },
          })
        ).toBe(0)
      })
    })

    describe('legacy sign-in rate limit through NextAuth (PostgreSQL)', () => {
      it('answers the same controlled error for existing and unknown accounts', async () => {
        const unknown = `legacy-unknown-${fixture}@example.test`
        const run = async (login: string, password: string) => {
          const client = newClient()
          const results: Array<{ status: number; error: string | null }> = []
          for (let index = 0; index < 5; index++) {
            const { status, error } = await signIn(
              login,
              'wrong-password',
              client
            )
            results.push({ status, error })
          }
          const { status, error } = await signIn(login, password, client)
          results.push({ status, error })
          return results
        }
        const existing = await run(email, newPassword)
        expect(existing.at(-1)).toEqual({ status: 401, error: 'RateLimited' })
        expect(existing.slice(0, 5)).toEqual(
          Array(5).fill({ status: 401, error: 'CredentialsSignin' })
        )
        expect(await run(unknown, 'any-password')).toEqual(existing)
      })

      it('a third party exhausting its window does not lock the owner out', async () => {
        const attacker = newClient()
        for (let index = 0; index < 5; index++)
          expect(await signIn(email, 'wrong-password', attacker)).toMatchObject(
            {
              error: 'CredentialsSignin',
            }
          )
        expect(await signIn(email, newPassword, attacker)).toMatchObject({
          status: 401,
          error: 'RateLimited',
        })
        const owner = await signIn(email, newPassword)
        expect(owner).toMatchObject({ status: 200, error: null })
        expect((await resolveSession(owner.jar))?.user).toMatchObject({
          id: userId,
        })
      })
    })

    describe('legacy lookup by e-mail never uses wildcards (PostgreSQL)', () => {
      const password = 'fixture-wildcard-password'
      const victimEmail = `wild.card-${fixture}@example.test`
      let victimId = ''
      beforeAll(async () => {
        createdEmails.push(victimEmail)
        victimId = (
          await prisma.user.create({
            data: {
              email: victimEmail,
              name: 'Wildcard victim',
              role: 'CLIENT',
              password: await bcrypt.hash(password, 10),
              cpf: `cpf-wild-${fixture}`,
            },
          })
        ).id
      })

      it('sign-in with _ or % in the e-mail does not reach another account', async () => {
        for (const pattern of [
          `wild_card-${fixture}@example.test`,
          `_ild.card-${fixture}@example.test`,
          `wild.card-${fixture}@example.tes_`,
          `wild%@example.test`,
          `%${fixture}@example.test`,
        ])
          expect(await signIn(pattern, password)).toMatchObject({
            status: 401,
            error: 'CredentialsSignin',
          })
        const owner = await signIn(victimEmail.toUpperCase(), password)
        expect(owner).toMatchObject({ status: 200, error: null })
        expect((await resolveSession(owner.jar))?.user).toMatchObject({
          id: victimId,
        })
      })

      it('an address with _ signs in even when look-alike rows exist', async () => {
        const real = `under_score-${fixture}@example.test`
        const decoys = ['under.score', 'under-score'].map(
          (local) => `${local}-${fixture}@example.test`
        )
        createdEmails.push(...decoys, real)
        for (const decoy of decoys)
          await prisma.user.create({
            data: {
              email: decoy,
              name: 'Look-alike',
              role: 'CLIENT',
              password: await bcrypt.hash('fixture-decoy-password', 10),
            },
          })
        const owner = await prisma.user.create({
          data: {
            email: real,
            name: 'Underscore owner',
            role: 'CLIENT',
            password: await bcrypt.hash(password, 10),
          },
        })
        const result = await signIn(real, password)
        expect(result).toMatchObject({ status: 200, error: null })
        expect((await resolveSession(result.jar))?.user).toMatchObject({
          id: owner.id,
        })
      })

      it('registration with _ creates its own account instead of matching another', async () => {
        const similar = `wild_card-${fixture}@example.test`
        createdEmails.push(similar)
        const response = await register(
          jsonRequest('/api/auth/register', {
            name: 'Underscore person',
            email: similar,
            password: 'fixture-underscore-password',
            phone: '11977776666',
            cpf: `cpf-underscore-${fixture}`,
          })
        )
        expect(response.status).toBe(202)
        const created = await prisma.user.findUnique({
          where: { email: similar },
        })
        expect(created).not.toBeNull()
        expect(created!.id).not.toBe(victimId)
      })

      it('an OAuth e-mail with _ is not bound to the account it resembles', async () => {
        const oauthEmail = `wild_oauth-${fixture}@example.test`
        const resembled = `wild.oauth-${fixture}@example.test`
        createdEmails.push(oauthEmail, resembled)
        const other = await prisma.user.create({
          data: { email: resembled, name: 'Resembled', role: 'CLIENT' },
        })
        const token = await authOptions.callbacks!.jwt!({
          token: { sub: `oauth-${fixture}` } as JWT,
          // Providers return no role; the callback resolves it.
          user: { id: `oauth-${fixture}`, email: oauthEmail } as User,
          account: {
            type: 'oauth',
            provider: 'google',
            providerAccountId: `oauth-${fixture}`,
          },
          profile: {},
          trigger: 'signIn',
        })
        const bound = await prisma.user.findUniqueOrThrow({
          where: { email: oauthEmail },
        })
        expect(token.id).toBe(bound.id)
        expect(token.id).not.toBe(other.id)
      })

      it('a row stored before normalization still signs in, _ included', async () => {
        const stored = `Legacy_Mixed.Case-${fixture}@Example.Test`
        createdEmails.push(stored)
        const legacy = await prisma.user.create({
          data: {
            email: stored,
            name: 'Legacy mixed case',
            role: 'CLIENT',
            password: await bcrypt.hash(password, 10),
          },
        })
        const owner = await signIn(stored.toLowerCase(), password)
        expect(owner).toMatchObject({ status: 200, error: null })
        expect((await resolveSession(owner.jar))?.user).toMatchObject({
          id: legacy.id,
        })
      })
    })

    describe('legacy registration neutrality (PostgreSQL)', () => {
      const payload = (address: string, cpf: string) => ({
        name: 'Registration fixture',
        email: address,
        password: 'fixture-registration-password',
        phone: '11988887777',
        cpf,
      })
      async function submit(address: string, cpf: string) {
        const response = await register(
          jsonRequest('/api/auth/register', payload(address, cpf))
        )
        return { status: response.status, body: await response.json() }
      }

      it('gives the same answer for an existing email, a new email and a document in use', async () => {
        const before = await prisma.user.findUniqueOrThrow({
          where: { id: userId },
        })
        const existing = await submit(email.toUpperCase(), `cpf-new-${fixture}`)

        const fresh = `legacy-register-${fixture}@example.test`
        createdEmails.push(fresh)
        const created = await submit(fresh, `cpf-fresh-${fixture}`)

        const collision = `legacy-collision-${fixture}@example.test`
        createdEmails.push(collision)
        const documentInUse = await submit(collision, `cpf-${fixture}`)

        expect(existing.status).toBe(202)
        expect(created).toEqual(existing)
        expect(documentInUse).toEqual(existing)

        const after = await prisma.user.findUniqueOrThrow({
          where: { id: userId },
        })
        expect(after).toEqual(before)
        expect(
          await prisma.user.count({
            where: { email: { equals: email, mode: 'insensitive' } },
          })
        ).toBe(1)
        expect(await prisma.user.count({ where: { email: collision } })).toBe(0)
        const newUser = await prisma.user.findUniqueOrThrow({
          where: { email: fresh },
        })
        expect(newUser.emailVerified).toBeNull()
        expect(
          await prisma.verificationToken.count({
            where: { identifier: `email-verification:${fresh}` },
          })
        ).toBe(1)
      })
    })
  }
)

// Close the fixture-created Prisma and Pool after original row cleanup.
afterAll(async () => {
  if (!fPreparedDatabase.pool) return
  try {
    await getFPreparedDatabaseRuntime().prisma.$disconnect()
  } finally {
    await fPreparedDatabase.pool.end()
  }
})
