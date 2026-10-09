import {
  platformRateLimitDigest,
  rateLimitKeyPrefix,
} from '../../packages/backend/src/modules/directory/rate-limit'
// Login do Better Auth na coexistência (AUTH_MODE=legacy + AUTH_V2_ENABLED=true, /api/auth/v2) contra o
// PostgreSQL descartável. Ele confere a senha legada pelo MESMO caminho do login do NextAuth
// (`verifyLegacyCredential`): igualdade exata do e-mail normalizado (`_` e `%` nunca são curinga de ILIKE),
// tentativa contada antes da busca nas MESMAS janelas persistentes de `lib/rate-limit.ts` e bcrypt fictício
// quando não há conta. Achado 17 da revisão da onda 3.
import { randomUUID } from 'node:crypto'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.hoisted(() => {
  // lib/auth lê o segredo quando o módulo é avaliado.
  process.env.NEXTAUTH_SECRET = 'fixture-legacy-credentials-v2-nextauth-secret'
})
vi.mock('@/lib/prisma', async () => {
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
  return {
    prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
    testPool: pool,
  }
})

import bcrypt from 'bcryptjs'
import type { CredentialsConfig } from 'next-auth/providers/credentials'

import { platformRateLimitSecret } from '../../packages/backend/src/modules/directory/rate-limit'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { legacySignInGuard } from '@/lib/rate-limit'
import { createIdentity } from '../../packages/backend/src/modules/identity/factory'
import { identityConfiguration } from '../../packages/backend/src/modules/identity/configuration'

const fixture = randomUUID()
const victim = `victim-${fixture}@example.test`
// Parecidas: `axb` é gravada antes de `a_b`, então um ILIKE com `a_b` acharia `axb` primeiro.
const lookAlike = `axb-${fixture}@example.test`
const underscored = `a_b-${fixture}@example.test`
const shared = `shared-${fixture}@example.test`
const emails = [victim, lookAlike, underscored, shared]
const victimPassword = 'victim-fixture-password'
const lookAlikePassword = 'look-alike-fixture-password'
const underscoredPassword = 'underscored-fixture-password'
const sharedPassword = 'shared-fixture-password'
const ids: Record<string, string> = {}
// Um /64 por caso: nem as janelas deste lote nem a do Better Auth se somam entre casos.
let network = 0
const usedIps: string[] = []
const usedAccounts = new Set<string>()
const newClient = () => {
  const ip = `2001:db8:${fixture.slice(0, 4)}:${(++network).toString(16)}::9`
  usedIps.push(ip)
  return ip
}

const mail = { sendPasswordReset: vi.fn(), sendEmailVerification: vi.fn() }
const config = identityConfiguration({
  AUTH_MODE: 'legacy',
  AUTH_V2_ENABLED: 'true',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'fixture-legacy-credential-secret-more-than-32',
})
// O mesmo limitador que lib/identity.ts entrega em produção (janelas do login legado).
const auth = createIdentity(prisma, config, mail, legacySignInGuard())

/** POST /api/auth/v2/sign-in/email pelo handler do Better Auth. */
const signInV2 = (email: string, password: string, ip: string) => {
  usedAccounts.add(email.trim().toLowerCase())
  return auth.handler(
    new Request(`${config.baseURL}${config.basePath}/sign-in/email`, {
      method: 'POST',
      headers: {
        origin: config.baseURL,
        'content-type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({ email, password }),
    })
  )
}
/** O `authorize` do NextAuth (/api/auth/[...nextauth]): 'user', 'rejected' ou o código do erro. */
function signInV1(email: string, password: string, ip: string) {
  usedAccounts.add(email.trim().toLowerCase())
  const provider = authOptions.providers.find(
    (candidate) => candidate.id === 'credentials'
  ) as CredentialsConfig & { options: CredentialsConfig }
  return provider.options
    .authorize(
      { email, password },
      {
        headers: { 'x-forwarded-for': ip },
        body: {},
        query: {},
        method: 'POST',
      }
    )
    .then(
      (user) => (user ? 'user' : 'rejected'),
      (error: Error) => error.message
    )
}
const credentialOf = (userId: string) =>
  prisma.authAccount.findUnique({
    where: {
      providerId_accountId: { providerId: 'credential', accountId: userId },
    },
  })

beforeAll(async () => {
  for (const [email, password] of [
    [victim, victimPassword],
    [lookAlike, lookAlikePassword],
    [underscored, underscoredPassword],
    [shared, sharedPassword],
  ] as const) {
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Legacy credential fixture',
        password: await bcrypt.hash(password, 12),
      },
    })
    ids[email] = user.id
  }
})
afterEach(() => {
  vi.restoreAllMocks()
})
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } })
  await prisma.authRateLimit.deleteMany({
    where: { key: { contains: `2001:db8:${fixture.slice(0, 4)}:` } },
  })
  // Janelas do login legado gravadas por estes casos (chave de processo fora de produção).
  const secret = platformRateLimitSecret(process.env)
  const prefixes = [
    ...[...usedAccounts].flatMap((account) =>
      ['account', 'account-ip'].map((kind) =>
        rateLimitKeyPrefix([
          'auth',
          'sign-in',
          kind,
          platformRateLimitDigest(secret, 'account', account),
        ])
      )
    ),
    ...usedIps.map((ip) =>
      rateLimitKeyPrefix([
        'auth',
        'sign-in',
        'ip',
        // Mesma forma canônica de lib/rate-limit (/64 do IPv6).
        platformRateLimitDigest(
          secret,
          'ip',
          `${ip
            .split(':')
            .slice(0, 4)
            .map((group) => Number.parseInt(group, 16).toString(16))
            .join(':')}::/64`
        ),
      ])
    ),
  ]
  for (const prefix of prefixes)
    await prisma.platformRateLimit.deleteMany({
      where: { key: { startsWith: prefix } },
    })
  await prisma.$disconnect()
  const { testPool } = (await import('@/lib/prisma')) as unknown as {
    testPool: { end(): Promise<void> }
  }
  await testPool.end()
})

describe('senha legada no login v2: igualdade exata do e-mail', () => {
  it('_ e % digitados não alcançam a conta de outra pessoa', async () => {
    for (const pattern of [
      `v_ctim-${fixture}@example.test`,
      `%-${fixture}@example.test`,
      `victim-${fixture}@%`,
      `victim-${fixture.slice(0, 8)}%@example.test`,
    ]) {
      expect(
        (await signInV2(pattern, victimPassword, newClient())).status,
        pattern
      ).toBe(401)
    }
    expect(await credentialOf(ids[victim]!)).toBeNull()
  })

  it('o e-mail exato, em maiúsculas, entra e sincroniza a senha legada', async () => {
    const response = await signInV2(
      victim.toUpperCase(),
      victimPassword,
      newClient()
    )
    expect(response.status).toBe(200)
    expect((await response.json()).user?.email).toBe(victim)
    expect((await credentialOf(ids[victim]!))?.userId).toBe(ids[victim])
  })

  it('um endereço com _ entra mesmo quando uma conta parecida vem antes', async () => {
    const response = await signInV2(
      underscored,
      underscoredPassword,
      newClient()
    )
    expect(response.status).toBe(200)
    expect((await response.json()).user?.email).toBe(underscored)
    expect(await credentialOf(ids[lookAlike]!)).toBeNull()
    // A senha da conta parecida não abre a conta com _.
    expect(
      (await signInV2(underscored, lookAlikePassword, newClient())).status
    ).toBe(401)
  })
})

describe('login v2 com o limitador e o custo do login legado', () => {
  it('a sexta tentativa de um cliente numa conta é recusada antes da busca, igual para conta inexistente', async () => {
    const run = async (email: string, password: string) => {
      const ip = newClient()
      const statuses: number[] = []
      for (let index = 0; index < 5; index++)
        statuses.push((await signInV2(email, 'wrong-password', ip)).status)
      const last = await signInV2(email, password, ip)
      statuses.push(last.status)
      return { statuses, retryAfter: last.headers.get('retry-after') }
    }
    const existing = await run(victim, victimPassword)
    expect(existing.statuses).toEqual([...Array(5).fill(401), 429])
    expect(Number(existing.retryAfter)).toBeGreaterThan(0)
    expect(await run(`missing-${fixture}@example.test`, 'any')).toMatchObject({
      statuses: existing.statuses,
    })
  })

  it('conta nas mesmas janelas do login do NextAuth: um não abre o limite do outro', async () => {
    const ip = newClient()
    for (let index = 0; index < 5; index++)
      expect(await signInV1(shared, 'wrong-password', ip)).toBe('rejected')
    // Esgotado pelo v1, o v2 recusa até a senha certa (e vice-versa).
    expect((await signInV2(shared, sharedPassword, ip)).status).toBe(429)
    const other = newClient()
    for (let index = 0; index < 5; index++)
      expect((await signInV2(shared, 'wrong-password', other)).status).toBe(401)
    expect(await signInV1(shared, sharedPassword, other)).toBe('RateLimited')
    // Outro cliente ainda entra pelos dois.
    expect(await signInV1(shared, sharedPassword, newClient())).toBe('user')
    expect((await signInV2(shared, sharedPassword, newClient())).status).toBe(
      200
    )
  })

  it('conta inexistente paga o mesmo bcrypt (custo 12) de uma senha errada', async () => {
    const compare = vi.spyOn(bcrypt, 'compare')
    expect(
      (
        await signInV2(
          `nobody-${fixture}@example.test`,
          'wrong-password',
          newClient()
        )
      ).status
    ).toBe(401)
    expect((await signInV2(victim, 'wrong-password', newClient())).status).toBe(
      401
    )
    expect(compare).toHaveBeenCalledTimes(2)
    for (const [, hash] of compare.mock.calls)
      expect(bcrypt.getRounds(hash as string)).toBe(12)
  })

  it('na coexistência, criar a identidade sem o limitador falha na hora', () => {
    expect(() => createIdentity(prisma, config, mail)).toThrow(/attempt guard/)
  })

  it('limitador que não conta (banco fora ou sem segredo em produção): 503 com Retry-After, nunca 500 nem 429, sem a mensagem', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    // Mensagem como a do Prisma: repete o e-mail e a connection string.
    const failure = Object.assign(
      new Error(
        `Invalid upsert for ${victim}: can't reach postgres://app:db-password-fixture@10.0.0.7:5432`
      ),
      { name: 'PrismaClientInitializationError', code: 'P1001' }
    )
    const failures = [
      async () => {
        throw failure
      },
      // O caminho real sem PLATFORM_RATE_LIMIT_SECRET em produção.
      async (attempt: { ip: string | null; account: string }) => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', 'curto-demais-fixture')
        try {
          return await legacySignInGuard().consume(attempt)
        } finally {
          vi.unstubAllEnvs()
        }
      },
    ]
    for (const consume of failures) {
      const down = createIdentity(prisma, config, mail, {
        ...legacySignInGuard(),
        consume,
      })
      usedAccounts.add(victim)
      const response = await down.handler(
        new Request(`${config.baseURL}${config.basePath}/sign-in/email`, {
          method: 'POST',
          headers: {
            origin: config.baseURL,
            'content-type': 'application/json',
            'x-forwarded-for': newClient(),
          },
          body: JSON.stringify({ email: victim, password: victimPassword }),
        })
      )
      expect(response.status).toBe(503)
      expect(response.headers.get('retry-after')).toBe('60')
      expect(response.headers.get('cache-control')).toBe('no-store')
      const body = await response.text()
      for (const secret of [
        'db-password-fixture',
        victim,
        'PLATFORM_RATE_LIMIT_SECRET',
        'curto-demais-fixture',
      ])
        expect(body).not.toContain(secret)
      expect(response.headers.getSetCookie()).toEqual([])
    }
    const logged = JSON.stringify(error.mock.calls)
    for (const secret of [
      'db-password-fixture',
      'curto-demais-fixture',
      victim,
    ])
      expect(logged).not.toContain(secret)
    expect(
      error.mock.calls.filter(([tag]) => tag === '[identity]').map(([, e]) => e)
    ).toEqual([
      {
        event: 'sign_in_unavailable',
        error: 'PrismaClientInitializationError',
      },
      { event: 'sign_in_unavailable', error: 'PlatformEnvError' },
    ])
  })
})
