const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  return (legacyPrisma.module = (await (async () => {
    // Identity windows live in platform_rate_limits: an in-memory stand-in,
    // kept for the whole file like the tables of a real database.
    const { createPlatformRateLimitTable } =
      await import('../helpers/platform-rate-limit-table')
    return {
      prisma: {
        user: {
          findMany: mocks.userFindMany,
          findUnique: mocks.userFindUnique,
          create: mocks.userCreate,
          update: mocks.userUpdate,
        },
        verificationToken: {
          findUnique: mocks.tokenFind,
          create: mocks.tokenCreate,
          deleteMany: mocks.tokenDeleteMany,
        },
        platformRateLimit: createPlatformRateLimitTable().platformRateLimit,
        $transaction: mocks.transaction,
      },
    }
  })()) as { prisma: unknown })
}
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => {
  // The API host's session composition reads the secret when the module is evaluated.
  process.env.NEXTAUTH_SECRET = 'fixture-nextauth-secret-for-security-tests'
  return {
    userFindMany: vi.fn(),
    userFindUnique: vi.fn(),
    userCreate: vi.fn(),
    userUpdate: vi.fn(),
    tokenFind: vi.fn(),
    tokenCreate: vi.fn(),
    tokenDeleteMany: vi.fn(),
    transaction: vi.fn(),
    send: vi.fn(),
    after: vi.fn(),
    hashRounds: [] as number[],
    compareRounds: [] as number[],
  }
})
// A fábrica abaixo monta o cliente (real ou simulado) que o serviço lê pelo runtime do backend.
const serviceDatabase = vi.hoisted(() => ({
  prisma: undefined as unknown,
  table: (() => {
    throw new Error('platform rate-limit table not loaded')
  }) as () => { platformRateLimit: unknown },
}))
const legacyPrisma = vi.hoisted(() => ({
  module: undefined as undefined | { prisma: unknown },
}))

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: mocks.after,
}))
vi.mock('bcryptjs', async (importOriginal) => {
  const actual = (
    (await importOriginal()) as { default: typeof import('bcryptjs') }
  ).default
  return {
    default: {
      ...actual,
      // Records the production cost while hashing cheaply in tests.
      hash: async (value: string, rounds: number) => {
        mocks.hashRounds.push(rounds)
        return actual.hash(value, 4)
      },
      // Records the cost compared; only the unknown-account hash uses a
      // production cost here, and it never matches.
      compare: async (value: string, hash: string) => {
        const rounds = actual.getRounds(hash)
        mocks.compareRounds.push(rounds)
        return rounds > 4 ? false : actual.compare(value, hash)
      },
    },
  }
})

import bcrypt from 'bcryptjs'
import { getServerSession, type User } from 'next-auth'
import { encode, type JWT } from 'next-auth/jwt'
import type { CredentialsConfig } from 'next-auth/providers/credentials'

// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade da raiz foi retirada no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    // O serviço tem as próprias janelas de limite (como numa execução à parte) sobre os mesmos dublês de usuário e token.
    getDatabaseRuntime: () => ({
      prisma: (serviceDatabase.prisma ??= {
        ...(legacyPrisma.module?.prisma as object),
        platformRateLimit: serviceDatabase.table().platformRateLimit,
      }),
    }),
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
vi.mock('@gb-locacoes/backend/identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/identity')>()),
  ...(await (async () => {
    const F = await (async () => {
      const config =
        await import('../../packages/backend/src/modules/identity/configuration')
      return {
        ...config,
        getIdentity: vi.fn(),
        handleIdentityRequest: vi.fn(),
      }
    })()
    return {
      createIdentityRuntime: () => ({
        getIdentity: F.getIdentity,
        handleIdentityRequest: F.handleIdentityRequest,
      }),
    }
  })()),
}))
import * as serviceSession from '../../apps/services/api/src/host/session'
import { createPlatformRateLimitTable } from '../helpers/platform-rate-limit-table'
serviceDatabase.table = createPlatformRateLimitTable

import * as serviceRoute0 from '../../apps/services/api/src/app/api/auth/forgot-password/route'

import * as serviceRoute1 from '../../apps/services/api/src/app/api/auth/reset-password/route'

import * as serviceRoute2 from '../../apps/services/api/src/app/api/auth/register/route'

const HOSTS = [
  [
    'service',
    {
      authOptions: serviceSession.authOptions,
      forgotPassword: serviceRoute0.POST,
      resetPassword: serviceRoute1.POST,
      register: serviceRoute2.POST,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (_host, { authOptions, forgotPassword, resetPassword, register }) => {
    const secret = 'fixture-nextauth-secret-for-security-tests'
    const correctPassword = 'fixture-correct-password'
    let storedHash = ''
    let rotatedHash = ''

    beforeAll(() => {
      storedHash = bcrypt.hashSync(correctPassword, 4)
      rotatedHash = bcrypt.hashSync('fixture-rotated-password', 4)
    })
    beforeEach(() => {
      vi.resetAllMocks()
      mocks.hashRounds.length = 0
      mocks.compareRounds.length = 0
      vi.stubEnv('AUTH_MODE', 'legacy')
      vi.stubEnv('AUTH_V2_ENABLED', '')
      vi.stubEnv('AUTH_CREDENTIAL_WRITES_PAUSED', '')
      vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
      vi.stubEnv('FROM_EMAIL', 'no-reply@example.test')
      vi.stubEnv('PLATFORM_NAME', '')
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      mocks.send.mockResolvedValue({ data: { id: 'email' }, error: null })
      mocks.userFindMany.mockResolvedValue([])
      // Route handlers run outside a Next request here, as in scripts.
      mocks.after.mockImplementation(() => {
        throw new Error('`after` was called outside a request scope')
      })
    })
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })

    const sha256 = (value: string) =>
      createHash('sha256').update(value).digest('hex')
    let sequence = 0
    const unique = (label: string) => `${label}-${Date.now()}-${++sequence}`

    // PostgreSQL ILIKE: '%' and '_' are wildcards unless escaped with '\'.
    function ilike(pattern: string, value: string): boolean {
      let source = ''
      for (let index = 0; index < pattern.length; index++) {
        const char = pattern[index]!
        if (char === '\\')
          source += (pattern[++index] ?? '').replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
          )
        else if (char === '%') source += '.*'
        else if (char === '_') source += '.'
        else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      }
      return new RegExp(`^${source}$`, 'is').test(value)
    }
    type StoredUser = {
      id: string
      email: string
      name: string
      role: string
      image: null
      password: string | null
    }
    function accounts(
      ...users: Array<Partial<StoredUser> & { email: string }>
    ) {
      const rows = users.map((user, index) => ({
        id: `user-${index}`,
        name: 'Fixture',
        role: 'CLIENT',
        image: null,
        password: storedHash,
        ...user,
      }))
      mocks.userFindMany.mockImplementation(
        async (args: {
          where: { email: { equals: string; mode?: string } }
          take?: number
        }) =>
          rows
            .filter((row) =>
              args.where.email.mode === 'insensitive'
                ? ilike(args.where.email.equals, row.email)
                : args.where.email.equals === row.email
            )
            .slice(0, args.take)
      )
      return rows
    }

    function authorize() {
      const provider = authOptions.providers.find(
        (candidate) => candidate.id === 'credentials'
      ) as CredentialsConfig & { options: CredentialsConfig }
      return (email: string, password: string, ip: string) =>
        provider.options.authorize(
          { email, password },
          {
            headers: { 'x-forwarded-for': ip },
            body: {},
            query: {},
            method: 'POST',
          }
        )
    }
    function knownAccount(email: string, id = 'user-fixture') {
      accounts({ id, email })
    }
    const outcome = (attempt: Promise<unknown>) =>
      attempt.then(
        (user) => (user ? 'user' : 'rejected'),
        (error: Error) => error.message
      )
    function jsonRequest(
      path: string,
      body: unknown,
      ip = `192.0.2.${(++sequence % 250) + 1}`
    ) {
      return new NextRequest(`http://localhost:3000${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify(body),
      })
    }

    describe('legacy credential sign-in rate limit', () => {
      it('stops the sixth attempt from one client for an account before any lookup, identically for unknown accounts', async () => {
        const signIn = authorize()
        const existing = `${unique('known')}@example.test`
        const unknown = `${unique('unknown')}@example.test`
        knownAccount(existing)
        const run = async (email: string, ip: string) => {
          const results: string[] = []
          for (let index = 0; index < 5; index++)
            results.push(await outcome(signIn(email, 'wrong-password', ip)))
          results.push(await outcome(signIn(email, correctPassword, ip)))
          return results
        }

        const existingResults = await run(existing, '198.51.100.10')
        expect(existingResults).toEqual([
          ...Array(5).fill('rejected'),
          'RateLimited',
        ])
        expect(mocks.userFindMany).toHaveBeenCalledTimes(5)
        // Same answers for an account that does not exist.
        expect(await run(unknown, '203.0.113.10')).toEqual(existingResults)
        expect(mocks.userFindMany).toHaveBeenCalledTimes(10)
      })

      it('a third party exhausting its own window never locks the owner out', async () => {
        const signIn = authorize()
        const victim = `${unique('victim')}@example.test`
        knownAccount(victim)
        for (let index = 0; index < 5; index++)
          expect(
            await outcome(signIn(victim, 'wrong-password', '203.0.113.66'))
          ).toBe('rejected')
        expect(
          await outcome(signIn(victim, correctPassword, '203.0.113.66'))
        ).toBe('RateLimited')
        expect(
          await outcome(signIn(victim, correctPassword, '198.51.100.67'))
        ).toBe('user')
      })

      it('past ten attempts on one account, answers wait progressively and the password is still checked', async () => {
        const signIn = authorize()
        const email = `${unique('distributed')}@example.test`
        knownAccount(email)
        for (let index = 0; index < 10; index++)
          expect(
            await outcome(signIn(email, 'wrong-password', `10.20.30.${index}`))
          ).toBe('rejected')

        vi.useFakeTimers({ toFake: ['setTimeout'] })
        const delayed = async (
          password: string,
          ip: string,
          delayMs: number
        ) => {
          let settled = false
          const lookups = mocks.userFindMany.mock.calls.length
          const pending = outcome(signIn(email, password, ip)).then(
            (result) => {
              settled = true
              return result
            }
          )
          await vi.advanceTimersByTimeAsync(delayMs - 1)
          expect(settled).toBe(false)
          // The wait happens before the account is even looked up.
          expect(mocks.userFindMany.mock.calls.length).toBe(lookups)
          await vi.advanceTimersByTimeAsync(1)
          return pending
        }
        expect(await delayed('wrong-password', '10.20.31.1', 500)).toBe(
          'rejected'
        )
        // The owner still gets in, just later.
        expect(await delayed(correctPassword, '10.20.31.2', 1000)).toBe('user')
      })

      it('parallel attempts on one account from many IPs: at most 100 per window reach the lookup and bcrypt', async () => {
        const signIn = authorize()
        const email = `${unique('parallel')}@example.test`
        knownAccount(email)
        vi.useFakeTimers({ toFake: ['setTimeout'] })
        let settled = false
        // 80 client IPs x 5 attempts at once: only the account ceiling stops them.
        const all = Promise.all(
          Array.from({ length: 400 }, (_, index) =>
            outcome(signIn(email, 'wrong-password', `10.40.${index % 80}.1`))
          )
        ).finally(() => {
          settled = true
        })
        for (let step = 0; step < 100 && !settled; step++)
          await vi.advanceTimersByTimeAsync(1000)
        const results = await all
        expect(results.filter((result) => result === 'rejected')).toHaveLength(
          100
        )
        expect(
          results.filter((result) => result === 'RateLimited')
        ).toHaveLength(300)
        expect(mocks.userFindMany).toHaveBeenCalledTimes(100)
        expect(mocks.compareRounds).toHaveLength(100)
        // The owner too waits for the next window: the ceiling holds the account.
        expect(await outcome(signIn(email, correctPassword, '10.41.0.1'))).toBe(
          'RateLimited'
        )
      })

      it('limits one client IP across different accounts', async () => {
        const signIn = authorize()
        knownAccount('nobody@example.test')
        const ip = '192.0.2.77'
        const results: string[] = []
        for (let index = 0; index < 21; index++)
          results.push(
            await outcome(
              signIn(`${unique('spray')}@example.test`, 'wrong-password', ip)
            )
          )
        expect(results.slice(0, 20)).toEqual(Array(20).fill('rejected'))
        expect(results[20]).toBe('RateLimited')
      })

      it('a successful sign-in clears the window of that client', async () => {
        const signIn = authorize()
        const email = `${unique('owner')}@example.test`
        knownAccount(email)
        for (let round = 0; round < 2; round++) {
          for (let index = 0; index < 4; index++)
            expect(
              await outcome(signIn(email, 'wrong-password', '10.1.0.1'))
            ).toBe('rejected')
          expect(
            await outcome(signIn(email, correctPassword, '10.1.0.1'))
          ).toBe('user')
        }
      })

      it('refuses an oversized e-mail before counting or querying', async () => {
        const signIn = authorize()
        const email = `${'a'.repeat(300)}@example.test`
        for (let index = 0; index < 8; index++)
          expect(
            await outcome(signIn(email, 'wrong-password', '10.2.0.1'))
          ).toBe('rejected')
        expect(mocks.userFindMany).not.toHaveBeenCalled()
      })
    })

    describe('legacy credential lookup by e-mail', () => {
      it('never treats _ or % as wildcards and still ignores case', async () => {
        const signIn = authorize()
        const victim = `${unique('joao.silva')}@example.test`
        knownAccount(victim)
        const [local, domain] = victim.split('@') as [string, string]
        const patterns = [
          victim.replace('joao.silva', 'joao_silva'),
          `_${victim.slice(1)}`,
          `${local.slice(0, 4)}%@${domain}`,
          `%@${domain}`,
          `${victim.slice(0, -1)}_`,
        ]
        for (const [index, pattern] of patterns.entries())
          expect(
            await outcome(signIn(pattern, correctPassword, `10.3.${index}.1`))
          ).toBe('rejected')
        expect(
          await outcome(
            signIn(victim.toUpperCase(), correctPassword, '10.3.9.1')
          )
        ).toBe('user')
      })

      it('an address with _ signs in even when look-alike accounts come first', async () => {
        const signIn = authorize()
        const real = `${unique('ana_paula')}@example.test`
        accounts(
          { id: 'decoy-1', email: real.replace('ana_paula', 'ana.paula') },
          { id: 'decoy-2', email: real.replace('ana_paula', 'ana-paula') },
          { id: 'real', email: real }
        )
        const user = await authorize()(real, correctPassword, '10.3.10.1')
        expect(user).toMatchObject({ id: 'real' })
        expect(await outcome(signIn(real, correctPassword, '10.3.10.2'))).toBe(
          'user'
        )
      })

      it('does not bind an OAuth login to an account matched by a wildcard', async () => {
        const [victim] = accounts({
          id: 'victim-id',
          email: 'maria.souza@example.test',
        })
        mocks.userCreate.mockImplementation(
          async (args: { data: { email: string } }) => ({
            id: 'created-id',
            role: 'CLIENT',
            ...args.data,
          })
        )
        mocks.userFindUnique.mockImplementation(
          async (args: { where: { id: string } }) => ({
            id: args.where.id,
            password: null,
          })
        )
        const token = await authOptions.callbacks!.jwt!({
          token: { sub: 'provider-sub' } as JWT,
          // Providers return no role; the callback resolves it.
          user: {
            id: 'provider-sub',
            email: 'Maria_Souza@example.test',
          } as User,
          account: {
            type: 'oauth',
            provider: 'google',
            providerAccountId: 'provider-sub',
          },
          profile: {},
          trigger: 'signIn',
        })
        expect(token.id).toBe('created-id')
        expect(token.id).not.toBe(victim!.id)
        expect(mocks.userUpdate).not.toHaveBeenCalled()
        expect(mocks.userCreate.mock.calls[0]![0].data.email).toBe(
          'maria_souza@example.test'
        )
      })

      it('unknown and password-less accounts pay the same bcrypt cost as a wrong password', async () => {
        const signIn = authorize()
        const withPassword = `${unique('with-password')}@example.test`
        const oauthOnly = `${unique('oauth-only')}@example.test`
        accounts({ email: withPassword }, { email: oauthOnly, password: null })
        for (const email of [
          withPassword,
          oauthOnly,
          `${unique('missing')}@example.test`,
        ])
          expect(
            await outcome(signIn(email, 'wrong-password', '10.4.0.1'))
          ).toBe('rejected')
        // Stored fixture hashes use cost 4; the stand-in uses the production cost.
        expect(mocks.compareRounds).toEqual([4, 12, 12])
      })
    })

    describe('legacy JWT credential version', () => {
      async function sessionCookie(email: string) {
        knownAccount(email)
        const user = await authorize()(email, correctPassword, '10.9.9.9')
        expect(user).toBeTruthy()
        mocks.userFindUnique.mockResolvedValue({
          id: 'user-fixture',
          password: storedHash,
        })
        const token = await authOptions.callbacks!.jwt!({
          token: { sub: 'user-fixture', email } as JWT,
          user: user!,
          account: {
            type: 'credentials',
            provider: 'credentials',
            providerAccountId: 'user-fixture',
          },
          trigger: 'signIn',
        })
        return { token, cookie: await encode({ token, secret }) }
      }
      function resolve(cookie: string) {
        const headers = new Map<string, unknown>()
        return getServerSession(
          {
            headers: { host: 'localhost:3000' },
            cookies: { 'next-auth.session-token': cookie },
          } as never,
          {
            getHeader: (name: string) => headers.get(name.toLowerCase()),
            setHeader: (name: string, value: unknown) =>
              headers.set(name.toLowerCase(), value),
          } as never,
          authOptions
        )
      }

      it('rejects a token issued before the stored password hash changed', async () => {
        const { token, cookie } = await sessionCookie(
          `${unique('rotate')}@example.test`
        )
        expect(typeof token.credentialVersion).toBe('string')
        expect(JSON.stringify(token)).not.toContain(storedHash)
        const session = await resolve(cookie)
        expect(session?.user).toMatchObject({
          id: 'user-fixture',
          role: 'CLIENT',
        })
        expect(JSON.stringify(session)).not.toContain('credentialVersion')

        mocks.userFindUnique.mockResolvedValue({
          id: 'user-fixture',
          password: rotatedHash,
        })
        expect(await resolve(cookie)).toBeNull()
      })

      it('rejects the token when the user no longer exists', async () => {
        const { cookie } = await sessionCookie(`${unique('gone')}@example.test`)
        mocks.userFindUnique.mockResolvedValue(null)
        expect(await resolve(cookie)).toBeNull()
      })

      it('grants nothing while the credential cannot be read, without revoking the cookie', async () => {
        const { cookie } = await sessionCookie(
          `${unique('outage')}@example.test`
        )
        mocks.userFindUnique.mockRejectedValue(new Error('storage unavailable'))
        expect(await resolve(cookie)).toBeNull()
        mocks.userFindUnique.mockResolvedValue({
          id: 'user-fixture',
          password: storedHash,
        })
        expect((await resolve(cookie))?.user).toMatchObject({
          id: 'user-fixture',
        })
      })

      it('does not accept a token that never carried a credential version', async () => {
        mocks.userFindUnique.mockResolvedValue({
          id: 'user-fixture',
          password: storedHash,
        })
        const cookie = await encode({
          token: { sub: 'user-fixture', id: 'user-fixture', role: 'ADMIN' },
          secret,
        })
        expect(await resolve(cookie)).toBeNull()
      })
    })

    describe('legacy forgot/reset password', () => {
      it('answers 429 after the budget of one client for an account, identically whether the account exists', async () => {
        const existing = `${unique('reset-known')}@example.test`
        const unknown = `${unique('reset-unknown')}@example.test`
        accounts({ id: 'u', email: existing })
        mocks.transaction.mockResolvedValue([])
        const run = async (email: string, ip: string) => {
          const results: Array<{ status: number; body: unknown }> = []
          for (let index = 0; index < 4; index++) {
            const response = await forgotPassword(
              jsonRequest('/api/auth/forgot-password', { email }, ip)
            )
            results.push({
              status: response.status,
              body: await response.json(),
            })
          }
          return results
        }
        const existingResults = await run(existing, '198.18.0.1')
        expect(existingResults.map((result) => result.status)).toEqual([
          200, 200, 200, 429,
        ])
        expect(mocks.userFindMany).toHaveBeenCalledTimes(3)
        expect(await run(unknown, '198.18.1.1')).toEqual(existingResults)
        expect(mocks.userFindMany).toHaveBeenCalledTimes(6)
      })

      it('a third party cannot block the owner, and the mailbox gets at most three links per window', async () => {
        const email = `${unique('reset-flood')}@example.test`
        accounts({ id: 'u', email })
        mocks.transaction.mockResolvedValue([])
        const statuses: number[] = []
        for (let index = 0; index < 6; index++)
          statuses.push(
            (
              await forgotPassword(
                jsonRequest(
                  '/api/auth/forgot-password',
                  { email },
                  `198.18.5.${index}`
                )
              )
            ).status
          )
        expect(statuses).toEqual(Array(6).fill(200))
        expect(mocks.send).toHaveBeenCalledTimes(3)
        expect(mocks.tokenCreate).toHaveBeenCalledTimes(3)
      })

      it('looks the account up, issues the link and sends it only after the response', async () => {
        const tasks: Array<() => Promise<void>> = []
        mocks.after.mockImplementation((task: () => Promise<void>) => {
          tasks.push(task)
        })
        const email = `${unique('deferred')}@example.test`
        accounts({ id: 'u', email })
        mocks.transaction.mockResolvedValue([])
        const known = await forgotPassword(
          jsonRequest('/api/auth/forgot-password', { email })
        )
        const missing = await forgotPassword(
          jsonRequest('/api/auth/forgot-password', {
            email: `${unique('deferred-missing')}@example.test`,
          })
        )
        expect(await known.json()).toEqual(await missing.json())
        expect(known.status).toBe(missing.status)
        expect(mocks.userFindMany).not.toHaveBeenCalled()
        expect(mocks.send).not.toHaveBeenCalled()
        expect(tasks).toHaveLength(2)
        for (const task of tasks) await task()
        expect(mocks.send).toHaveBeenCalledTimes(1)
      })

      it('stores only the SHA-256 of the emailed token and brands the email with the platform', async () => {
        // The brand comes from platform.json; the retired PLATFORM_NAME variable no longer changes it.
        vi.stubEnv('PLATFORM_NAME', 'Plataforma Fixture')
        const email = `${unique('hash')}@example.test`
        accounts({ id: 'u', email })
        mocks.tokenDeleteMany.mockReturnValue('delete-previous')
        mocks.tokenCreate.mockReturnValue('create-hashed')
        mocks.transaction.mockResolvedValue([])
        const response = await forgotPassword(
          jsonRequest('/api/auth/forgot-password', { email }, '198.18.2.1')
        )
        expect(response.status).toBe(200)
        const message = mocks.send.mock.calls[0]![0] as {
          subject: string
          html: string
        }
        const link = /href="([^"]+)"/
          .exec(message.html)![1]!
          .replace(/&amp;/g, '&')
        const rawToken = new URL(link).searchParams.get('token')!
        expect(rawToken.length).toBeGreaterThanOrEqual(43)
        const stored = mocks.tokenCreate.mock.calls[0]![0].data
        expect(stored.identifier).toBe(`password-reset:${email}`)
        expect(stored.token).toBe(sha256(rawToken))
        expect(stored.token).not.toContain(rawToken)
        expect(mocks.tokenDeleteMany).toHaveBeenCalledWith({
          where: { identifier: `password-reset:${email}` },
        })
        expect(mocks.transaction).toHaveBeenCalledWith([
          'delete-previous',
          'create-hashed',
        ])
        expect(message.subject).toBe(
          `Recuperação de senha - ${PLATFORM.displayName}`
        )
        expect(`${message.subject}${message.html}`).not.toMatch(/GB\s*Loca/i)
      })

      it('brands the subject with platform.json even without PLATFORM_NAME', async () => {
        const email = `${unique('plain')}@example.test`
        accounts({ id: 'u', email })
        mocks.transaction.mockResolvedValue([])
        await forgotPassword(
          jsonRequest('/api/auth/forgot-password', { email }, '198.18.3.1')
        )
        expect(mocks.send.mock.calls[0]![0].subject).toBe(
          `Recuperação de senha - ${PLATFORM.displayName}`
        )
      })

      it('reset looks tokens up by hash, never by the presented value', async () => {
        mocks.tokenFind.mockResolvedValue(null)
        const response = await resetPassword(
          jsonRequest('/api/auth/reset-password', {
            token: 'presented-token',
            password: 'fixture-new-password',
          })
        )
        expect(response.status).toBe(400)
        expect(mocks.tokenFind).toHaveBeenCalledWith({
          where: { token: sha256('presented-token') },
        })
        expect(mocks.transaction).not.toHaveBeenCalled()
      })

      it('a completed reset lets every client sign in again', async () => {
        const signIn = authorize()
        const email = `${unique('reset-unlocks')}@example.test`
        knownAccount(email)
        for (let index = 0; index < 5; index++)
          await outcome(signIn(email, 'wrong-password', '10.5.0.1'))
        expect(await outcome(signIn(email, correctPassword, '10.5.0.1'))).toBe(
          'RateLimited'
        )
        mocks.tokenFind.mockResolvedValue({
          identifier: `password-reset:${email}`,
          token: sha256('emailed-token'),
          expires: new Date(Date.now() + 60_000),
        })
        mocks.userFindUnique.mockResolvedValue({ id: 'user-fixture', email })
        mocks.transaction.mockImplementation(
          async (operation: (_tx: unknown) => Promise<unknown>) =>
            operation({
              verificationToken: { deleteMany: async () => ({ count: 1 }) },
              user: { update: async () => ({}) },
            })
        )
        const response = await resetPassword(
          jsonRequest('/api/auth/reset-password', {
            token: 'emailed-token',
            password: 'fixture-new-password',
          })
        )
        expect(response.status).toBe(200)
        expect(await outcome(signIn(email, correctPassword, '10.5.0.1'))).toBe(
          'user'
        )
      })
      it('reset hashes the new password with async bcrypt at the stored cost (12)', async () => {
        const email = `${unique('reset-async')}@example.test`
        const hashSync = vi.spyOn(bcrypt, 'hashSync')
        const stored: string[] = []
        mocks.tokenFind.mockResolvedValue({
          identifier: `password-reset:${email}`,
          token: sha256('emailed-token'),
          expires: new Date(Date.now() + 60_000),
        })
        mocks.userFindUnique.mockResolvedValue({ id: 'user-fixture', email })
        mocks.transaction.mockImplementation(
          async (operation: (_tx: unknown) => Promise<unknown>) =>
            operation({
              verificationToken: { deleteMany: async () => ({ count: 1 }) },
              user: {
                update: async (args: { data: { password: string } }) => {
                  stored.push(args.data.password)
                  return {}
                },
              },
            })
        )
        const response = await resetPassword(
          jsonRequest('/api/auth/reset-password', {
            token: 'emailed-token',
            password: 'fixture-new-password',
          })
        )
        expect(response.status).toBe(200)
        // O hash síncrono prende o event loop do servidor durante o custo 12.
        expect(hashSync).not.toHaveBeenCalled()
        expect(mocks.hashRounds).toEqual([12])
        expect(stored).toHaveLength(1)
        expect(await bcrypt.compare('fixture-new-password', stored[0]!)).toBe(
          true
        )
      })
    })

    describe('legacy registration', () => {
      const payload = (email: string, cpf = '00000000000') => ({
        name: 'Fixture Person',
        email,
        password: 'fixture-password',
        phone: '11999999999',
        cpf,
      })
      function recordCreatedUsers() {
        const created: string[] = []
        mocks.transaction.mockImplementation(
          async (operation: (_tx: unknown) => Promise<unknown>) =>
            operation({
              user: {
                create: async (args: { data: { email: string } }) => {
                  created.push(args.data.email)
                  return { email: args.data.email }
                },
              },
              verificationToken: { create: async () => ({}) },
            })
        )
        return created
      }
      const send = async (email: string, ip?: string) => {
        const response = await register(
          jsonRequest('/api/auth/register', payload(email), ip)
        )
        return { status: response.status, body: await response.json() }
      }

      it('answers identically for new, existing and conflicting data and always pays the bcrypt cost', async () => {
        const created = recordCreatedUsers()
        const existingEmail = `${unique('taken')}@example.test`
        accounts({ email: existingEmail })

        const existing = await send(existingEmail)
        const fresh = await send(`${unique('fresh')}@example.test`)
        mocks.transaction.mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'fixture',
          })
        )
        const conflicting = await send(`${unique('cpf-in-use')}@example.test`)

        expect(existing.status).toBe(202)
        expect(fresh).toEqual(existing)
        expect(conflicting).toEqual(existing)
        expect(JSON.stringify(existing.body)).not.toMatch(/cadastrad|existe/i)
        expect(created).toHaveLength(1)
        expect(mocks.hashRounds).toEqual([12, 12, 12])
      })

      it('an address with _ is new even when a similar account exists', async () => {
        const created = recordCreatedUsers()
        const holder = `${unique('ana.lima')}@example.test`
        accounts({ email: holder })
        const similar = holder.replace('ana.lima', 'ana_lima')
        expect((await send(similar)).status).toBe(202)
        expect(created).toEqual([similar])
      })

      it('limits registrations per client IP and per target e-mail before hashing', async () => {
        recordCreatedUsers()
        const ip = '198.19.0.1'
        const perIp: number[] = []
        for (let index = 0; index < 11; index++)
          perIp.push(
            (await send(`${unique('ip-burst')}@example.test`, ip)).status
          )
        expect(perIp).toEqual([...Array(10).fill(202), 429])
        expect(mocks.hashRounds).toHaveLength(10)

        const target = `${unique('target')}@example.test`
        const perTarget: number[] = []
        for (let index = 0; index < 6; index++)
          perTarget.push((await send(target, `198.19.1.${index}`)).status)
        expect(perTarget).toEqual([...Array(5).fill(202), 429])
        expect(mocks.hashRounds).toHaveLength(15)
      })

      it('in production warns an existing holder at most once per window, after the response', async () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('VERCEL', '1')
        // Required in production: the identity limiters refuse without it.
        vi.stubEnv(
          'PLATFORM_RATE_LIMIT_SECRET',
          'fixture-hardening-rate-limit-secret-0123456789'
        )
        const tasks: Array<() => Promise<void>> = []
        mocks.after.mockImplementation((task: () => Promise<void>) => {
          tasks.push(task)
        })
        const created = recordCreatedUsers()
        const holder = `${unique('holder')}@example.test`
        accounts({ email: holder })
        const submit = async (email: string, ip: string) => {
          const response = await register(
            new NextRequest('http://localhost:3000/api/auth/register', {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-real-ip': ip },
              body: JSON.stringify(payload(email)),
            })
          )
          return { status: response.status, body: await response.json() }
        }

        const first = await submit(holder, '198.19.2.1')
        expect(mocks.send).not.toHaveBeenCalled()
        expect(tasks).toHaveLength(1)
        const again: Array<typeof first> = []
        for (let index = 0; index < 3; index++)
          again.push(await submit(holder, `198.19.2.${index + 2}`))
        expect(again).toEqual(Array(3).fill(first))
        expect(tasks).toHaveLength(1)

        const fresh = await submit(
          `${unique('welcome')}@example.test`,
          '198.19.2.9'
        )
        expect(fresh).toEqual(first)
        expect(created).toHaveLength(1)
        expect(mocks.send).not.toHaveBeenCalled()
        for (const task of tasks) await task()
        expect(
          mocks.send.mock.calls.map(([message]) => message.subject)
        ).toEqual([
          `Tentativa de cadastro - ${PLATFORM.displayName}`,
          `Verifique seu email - ${PLATFORM.displayName}`,
        ])
        expect(mocks.send.mock.calls[0]![0].to).toBe(holder)
      })
    })
  }
)
