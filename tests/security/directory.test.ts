import {
  platformRateLimitDigest,
  rateLimitKeyPrefix,
} from '../../packages/backend/src/modules/directory/rate-limit'
/**
 * T13 (ADR docs/architecture/adr-tenant-hosts.md, Diretório e Migração B):
 * busca pública de locadoras em `GET /api/public/tenants?q=`.
 *
 * - `q` curto, longo, repetido, ausente ou acompanhado de outro parâmetro dá
 *   400 antes de qualquer acesso ao banco (e não consome a janela);
 * - no máximo 10 resultados, só `ACTIVE` com opt-in (`directoryListed`);
 * - sem CNPJ, telefone, e-mail, CEP ou logo, mesmo com esses dados gravados;
 * - `%`, `_` e `\` são literais (o Prisma não escapa curingas do ILIKE);
 * - 429 persiste entre instâncias: a janela vive em `platform_rate_limits`,
 *   chaveada por HMAC do IP com `PLATFORM_RATE_LIMIT_SECRET`, e o IP vem da
 *   borda validada quando há uma.
 *
 * Sem TEST_DATABASE_URL, o Prisma é um dublê que falha em qualquer acesso e
 * só os blocos sem banco rodam. Com banco descartável, o bloco final grava
 * locadoras de verdade e usa dois módulos da rota (duas instâncias, dois pools).
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('@/lib/prisma', async () => {
  if (process.env.TEST_DATABASE_URL) {
    const { requireTestDatabase } = await import('../helpers/test-database')
    const { Pool } = await import('pg')
    const { PrismaClient } = await import('@prisma/client')
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const pool = new Pool({
      connectionString: requireTestDatabase(process.env),
      max: 4,
    })
    return {
      prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
      testPool: pool,
    }
  }
  const unavailable = () => {
    throw new Error('database access is not expected in this suite')
  }
  return {
    prisma: {
      organization: { findMany: unavailable },
      platformRateLimit: { upsert: unavailable, deleteMany: unavailable },
    },
  }
})

import type { PrismaClient } from '@prisma/client'
import {
  DIRECTORY_SEARCH_MAX_RESULTS,
  DirectorySearchResponseSchema,
} from '@gb-locacoes/contracts/directory'
import {
  DIRECTORY_SEARCH_RATE_LIMIT,
  escapeLikePattern,
  parseDirectorySearchParams,
  prismaRateLimitCounter,
  purgeExpiredPlatformRateLimits,
  searchDirectory,
  type DirectorySearchDatabase,
} from '@gb-locacoes/backend/directory'
import { platformRateLimitSecret } from '../../packages/backend/src/modules/directory/rate-limit'
import { withTenantTransaction } from '@gb-locacoes/backend/identity'
import { prisma } from '@/lib/prisma'
import { GET as search } from '@/app/api/public/tenants/route'
import { requireTestDatabase } from '../helpers/test-database'

const API = 'https://backend.internal'
const ROOT = 'plataforma.test'
const EDGE_SECRET = 'edge-secret-directory-search-0123456789'
const get = (query: string, headers: Record<string, string> = {}) =>
  new Request(`${API}/api/public/tenants${query}`, { headers })
const apexEdge = (clientIp: string, secret = EDGE_SECRET) => ({
  'x-platform-edge-auth': secret,
  'x-platform-host-kind': 'apex',
  'x-platform-origin': `https://${ROOT}`,
  'x-platform-client-ip': clientIp,
})
/** An address from 198.18.0.0/15 (benchmarking), fresh for each call. */
const freshIp = () => {
  const bytes = randomBytes(2)
  return `198.${18 + (bytes[0]! % 2)}.${bytes[1]}.${1 + (randomBytes(1)[0]! % 254)}`
}
const INVALID_QUERIES = [
  '',
  '?q=',
  '?q=ab',
  '?q=%20%20ab%20%20',
  `?q=${'a'.repeat(81)}`,
  '?q=acme&q=beta',
  '?q=acme&page=2',
  '?q=acme&cursor=x',
  '?q=acme&limit=50',
  '?q=acme&tenantSlug=acme',
  '?Q=acme',
  // Caracteres de controle: NUL faria o PostgreSQL recusar o ILIKE (500) depois de consumir a janela.
  '?q=%00%00%00',
  '?q=%00acme',
  '?q=ac%01me',
  '?q=ac%0Ame',
  '?q=acme%7F',
  '?q=ac%C2%85me',
]

beforeEach(() => {
  vi.stubEnv('PLATFORM_ENV', 'staging')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
  vi.stubEnv('PLATFORM_EDGE_SECRET', EDGE_SECRET)
  vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('TRUSTED_PROXY_HOPS', '')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('directory search parameters', () => {
  it('accept exactly one q with 3 to 80 characters after trim, and nothing else', () => {
    const parse = (query: string) =>
      parseDirectorySearchParams(new URL(`${API}/x${query}`).searchParams)
    for (const query of INVALID_QUERIES) expect(parse(query), query).toBeNull()
    expect(parse('?q=abc')).toEqual({ q: 'abc' })
    expect(parse('?q=%20%20abc%20')).toEqual({ q: 'abc' })
    expect(parse(`?q=${'a'.repeat(80)}`)).toEqual({ q: 'a'.repeat(80) })
  })

  it('keys windows with PLATFORM_RATE_LIMIT_SECRET; in production a missing or short one fails fast, elsewhere a per-process key', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const configured = `  ${'k'.repeat(32)}  `
    expect(
      platformRateLimitSecret({
        NODE_ENV: 'production',
        PLATFORM_RATE_LIMIT_SECRET: configured,
      })
    ).toBe('k'.repeat(32))
    const short = 'short-secret-value'
    for (const env of [
      { NODE_ENV: 'production', PLATFORM_RATE_LIMIT_SECRET: short },
      { NODE_ENV: 'production', PLATFORM_RATE_LIMIT_SECRET: '   ' },
      { NODE_ENV: 'production' },
    ]) {
      let thrown: unknown
      try {
        platformRateLimitSecret(env)
      } catch (caught) {
        thrown = caught
      }
      expect(thrown).toBeInstanceOf(Error)
      expect((thrown as Error).name).toBe('PlatformEnvError')
      expect((thrown as Error).message).toMatch(
        /PLATFORM_RATE_LIMIT_SECRET.*produção/
      )
      expect((thrown as Error).message).not.toContain(short)
    }
    // Logged at most once per process, never with the value.
    expect(error.mock.calls.length).toBeLessThanOrEqual(1)
    for (const call of error.mock.calls)
      expect(JSON.stringify(call)).not.toContain(short)
    // Development and tests keep one local key per process.
    const local = platformRateLimitSecret({
      NODE_ENV: 'development',
      PLATFORM_RATE_LIMIT_SECRET: short,
    })
    expect(local).toMatch(/^[0-9a-f]{64}$/)
    expect(platformRateLimitSecret({ NODE_ENV: 'test' })).toBe(local)
  })

  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLikePattern('100%_off\\x')).toBe('100\\%\\_off\\\\x')
    expect(escapeLikePattern('acme')).toBe('acme')
  })
})

describe('directory search reads only listed ACTIVE tenants and publishes only the card fields', () => {
  it('asks the database for opted-in ACTIVE names, 10 at most, selecting only public columns', async () => {
    const calls: unknown[] = []
    const db = {
      organization: {
        findMany: async (args: unknown) => {
          calls.push(args)
          return []
        },
      },
    } as unknown as DirectorySearchDatabase
    await searchDirectory(db, { q: '50%_off' })
    expect(calls).toEqual([
      {
        where: {
          directoryListed: true,
          status: 'ACTIVE',
          name: { contains: '50\\%\\_off', mode: 'insensitive' },
        },
        select: { slug: true, name: true, city: true, state: true },
        orderBy: [{ name: 'asc' }, { slug: 'asc' }],
        take: DIRECTORY_SEARCH_MAX_RESULTS,
      },
    ])
  })

  it('drops extra columns, reserved slugs and blank names; normalizes city and UF', async () => {
    const db = {
      organization: {
        findMany: async () => [
          {
            slug: 'acme',
            name: '  Acme Locações ',
            city: ' Curitiba ',
            state: 'pr',
            document: '00.000.000/0001-00',
            postalCode: '80000-000',
            companyPhone: '+55 41 0000-0000',
            contactEmail: 'contato@acme.example',
            companyIconUrl: 'https://cdn.example/acme.png',
          },
          { slug: 'admin', name: 'Reservada', city: null, state: null },
          { slug: 'vazia', name: '   ', city: null, state: null },
          { slug: 'sem-uf', name: 'Sem UF', city: '', state: 'Paraná' },
        ],
      },
    } as unknown as DirectorySearchDatabase
    const response = await searchDirectory(db, { q: 'acme' })
    expect(response).toEqual({
      results: [
        { slug: 'acme', name: 'Acme Locações', city: 'Curitiba', state: 'PR' },
        { slug: 'sem-uf', name: 'Sem UF', city: null, state: null },
      ],
    })
    expect(DirectorySearchResponseSchema.parse(response)).toEqual(response)
  })
})

describe('directory search route validation', () => {
  it('answers 400 no-store for invalid parameters before any database access', async () => {
    for (const query of INVALID_QUERIES) {
      const response = await search(
        get(query, { 'x-forwarded-for': freshIp() })
      )
      expect(response.status, query).toBe(400)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.json()).toEqual({
        error: 'Informe apenas q, com 3 a 80 caracteres.',
        code: 'INVALID_QUERY',
      })
    }
  })
})

describe('directory search route: the rate-limit secret follows the platform production criterion', () => {
  const loggedErrors = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls
      .flat()
      .filter((value): value is Error => value instanceof Error)
      .map((value) => value.name)

  it('PLATFORM_ENV=production without PLATFORM_RATE_LIMIT_SECRET refuses before counting, whatever NODE_ENV says', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubEnv('PLATFORM_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', '')
    const response = await search(
      get('?q=acme', { 'x-forwarded-for': freshIp() })
    )
    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('no-store')
    // The configuration error, not a database one: nothing was counted or searched.
    expect(loggedErrors(error)).toEqual(['PlatformEnvError'])
  })

  it('a Vercel preview (NODE_ENV=production, VERCEL_ENV=preview) is not production: without the secret it keys per process', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubEnv('PLATFORM_ENV', '')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', '')
    const ip = freshIp()
    const response = await search(get('?q=acme', apexEdge(ip)))
    expect(loggedErrors(error)).not.toContain('PlatformEnvError')
    if (!process.env.TEST_DATABASE_URL) return
    expect(response.status).toBe(200)
    // The window this call opened, keyed with this process's own secret.
    const processSecret = platformRateLimitSecret({ NODE_ENV: 'test' })
    await (prisma as unknown as PrismaClient).platformRateLimit.deleteMany({
      where: {
        key: {
          startsWith: rateLimitKeyPrefix([
            'directory-search',
            'ip',
            platformRateLimitDigest(processSecret, 'ip', ip),
          ]),
        },
      },
    })
  })

  it('one rule: in the application, only the shared security-env module turns the environment into the secret', () => {
    const root = path.resolve(__dirname, '../..')
    const sources = (directory: string): string[] =>
      readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(
        (entry) => {
          const relative = path.join(directory, entry.name)
          if (entry.isDirectory())
            return entry.name === 'node_modules' ? [] : sources(relative)
          return /\.(ts|tsx)$/.test(entry.name) &&
            !/\.test\.(ts|tsx)$/.test(entry.name)
            ? [relative.split(path.sep).join('/')]
            : []
        }
      )
    // A API compartilhada e o backend têm de existir; a raiz legada (`app`, `lib`) entra enquanto existir (sai no
    // bloco F da onda 135) sem derrubar a varredura por pasta ausente.
    const required = ['packages/backend/src', 'apps/services/api/src']
    for (const directory of required)
      expect(existsSync(path.join(root, directory)), directory).toBe(true)
    const callers = [
      ...required,
      ...['app', 'lib'].filter((directory) =>
        existsSync(path.join(root, directory))
      ),
    ]
      .flatMap(sources)
      .filter((file) =>
        /\bplatformRateLimitSecret\s*\(/.test(
          readFileSync(path.join(root, file), 'utf8')
        )
      )
      .sort()
    // The definition itself and the one application caller (identityRateLimitSecret, isPlatformProduction).
    expect(callers).toEqual([
      'packages/backend/src/modules/directory/rate-limit.ts',
      'packages/backend/src/modules/directory/security-env.ts',
    ])
  })
})

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'directory search on the disposable database',
  () => {
    const db = prisma as unknown as PrismaClient
    const run = randomUUID().replace(/-/g, '').slice(0, 10)
    const marker = `DIR${run.toUpperCase()}`
    const slug = (label: string) => `dir-${run}-${label}`
    const listed = Array.from({ length: 12 }, (_, index) =>
      String(index + 1).padStart(2, '0')
    )
    const leaks = {
      document: '12.345.678/0001-95',
      postalCode: '80010-000',
      companyPhone: '+55 41 3333-4444',
      whatsappNumber: '5541999998888',
      contactEmail: `contato-${run}@locadora.example`,
      companyIconUrl: `https://cdn.example/${run}/logo.png`,
    }
    const organizations = [
      ...listed.map((label, index) => ({
        id: `fixture-dir-${run}-${label}`,
        slug: slug(label),
        name: `Locadora ${marker} ${label}`,
        city: index % 2 ? '  Curitiba ' : null,
        state: index % 2 ? 'pr' : null,
        document: leaks.document,
        postalCode: leaks.postalCode,
        directoryListed: true,
        status: 'ACTIVE' as const,
      })),
      {
        id: `fixture-dir-${run}-promo`,
        slug: slug('promo'),
        name: `Aluguel 50%_off ${marker}`,
        city: null,
        state: null,
        directoryListed: true,
        status: 'ACTIVE' as const,
      },
      {
        id: `fixture-dir-${run}-suspensa`,
        slug: slug('suspensa'),
        name: `Locadora ${marker} 00 Suspensa`,
        city: null,
        state: null,
        directoryListed: true,
        status: 'SUSPENDED' as const,
      },
      {
        id: `fixture-dir-${run}-oculta`,
        slug: slug('oculta'),
        name: `Locadora ${marker} 00 Oculta`,
        city: null,
        state: null,
        directoryListed: false,
        status: 'ACTIVE' as const,
      },
    ]
    const ids = organizations.map((organization) => organization.id)
    const secret = randomBytes(32).toString('hex')
    const usedIps = new Set<string>()
    const ipFor = () => {
      const ip = freshIp()
      usedIps.add(ip)
      return ip
    }
    const instances: Array<{
      client: PrismaClient
      pool: { end(): Promise<void> }
    }> = []
    let windowEnd = 0

    /** Another server instance: fresh modules over a new Prisma client and pool. */
    async function freshInstance() {
      const { Pool } = await import('pg')
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const { PrismaClient } = await import('@prisma/client')
      const pool = new Pool({
        connectionString: requireTestDatabase(process.env),
        max: 2,
      })
      const client = new PrismaClient({ adapter: new PrismaPg(pool) })
      instances.push({ client, pool })
      vi.resetModules()
      vi.doMock('@/lib/prisma', () => ({ prisma: client }))
      const route = await import('@/app/api/public/tenants/route')
      const shared = await import('@/lib/prisma')
      expect(shared.prisma).toBe(client)
      expect(shared.prisma).not.toBe(prisma)
      return route.GET
    }

    beforeAll(async () => {
      await db.organization.createMany({ data: organizations })
      // Tenant data that must never reach the directory.
      await withTenantTransaction(db, { tenantId: ids[0]! }, (tx) =>
        tx.setting.create({
          data: {
            tenantId: ids[0]!,
            companyPhone: leaks.companyPhone,
            whatsappNumber: leaks.whatsappNumber,
            contactEmail: leaks.contactEmail,
            companyIconUrl: leaks.companyIconUrl,
          },
        })
      )
    })
    beforeEach(() => {
      vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', secret)
    })
    afterAll(async () => {
      await withTenantTransaction(db, { tenantId: ids[0]! }, (tx) =>
        tx.setting.deleteMany({ where: { tenantId: ids[0]! } })
      )
      await db.organization.deleteMany({ where: { id: { in: ids } } })
      for (const ip of usedIps)
        await db.platformRateLimit.deleteMany({
          where: {
            key: {
              startsWith: rateLimitKeyPrefix([
                'directory-search',
                'ip',
                platformRateLimitDigest(secret, 'ip', ip),
              ]),
            },
          },
        })
      // The window of the instance without a configured secret (unknown HMAC key).
      if (windowEnd)
        await db.platformRateLimit.deleteMany({
          where: {
            key: { startsWith: 'directory-search:ip:' },
            expiresAt: new Date(windowEnd),
          },
        })
      for (const { client, pool } of instances) {
        await client.$disconnect()
        await pool.end()
      }
    })

    it('returns at most 10 opted-in ACTIVE tenants by name, case-insensitively', async () => {
      const response = await search(
        get(`?q=${marker.toLowerCase()}`, { 'x-forwarded-for': ipFor() })
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('public, max-age=60')
      const body = DirectorySearchResponseSchema.parse(await response.json())
      expect(body.results.map((item) => item.slug)).toEqual([
        slug('promo'),
        ...listed.slice(0, 9).map(slug),
      ])
      expect(body.results[0]).toEqual({
        slug: slug('promo'),
        name: `Aluguel 50%_off ${marker}`,
        city: null,
        state: null,
      })
      expect(body.results[2]).toEqual({
        slug: slug('02'),
        name: `Locadora ${marker} 02`,
        city: 'Curitiba',
        state: 'PR',
      })
      for (const item of body.results)
        expect(Object.keys(item).sort()).toEqual([
          'city',
          'name',
          'slug',
          'state',
        ])
    })

    it('never lists suspended or unlisted tenants, even when they are the only match', async () => {
      for (const query of [`${marker} 00`, 'Suspensa', 'Oculta']) {
        const response = await search(
          get(`?q=${encodeURIComponent(query)}`, { 'x-forwarded-for': ipFor() })
        )
        expect(response.status).toBe(200)
        const slugs = (await response.json()).results.map(
          (item: { slug: string }) => item.slug
        )
        expect(slugs).not.toContain(slug('suspensa'))
        expect(slugs).not.toContain(slug('oculta'))
      }
    })

    it('publishes no CNPJ, phone, e-mail, CEP or logo stored for the tenant', async () => {
      const response = await search(
        get(`?q=${marker}`, { 'x-forwarded-for': ipFor() })
      )
      const text = await response.text()
      expect(text).toContain(slug('01'))
      for (const value of Object.values(leaks))
        expect(text).not.toContain(value)
      expect(text).not.toMatch(/logo|document|postal|phone|email|cnpj|cep/i)
    })

    it('treats %, _ and \\ in q as literal characters', async () => {
      const results = async (q: string) => {
        const response = await search(
          get(`?q=${encodeURIComponent(q)}`, { 'x-forwarded-for': ipFor() })
        )
        expect(response.status).toBe(200)
        return (await response.json()).results.map(
          (item: { slug: string }) => item.slug
        ) as string[]
      }
      const ours = (slugs: string[]) =>
        slugs.filter((value) => value.startsWith(`dir-${run}-`))
      // Unescaped, '%%%' and '___' would match every listed tenant.
      expect(ours(await results('%%%'))).toEqual([])
      expect(ours(await results('___'))).toEqual([])
      expect(
        ours(await results(`${marker.slice(0, 4)}_${marker.slice(5)}`))
      ).toEqual([])
      expect(ours(await results('\\\\\\'))).toEqual([])
      expect(ours(await results('50%_off'))).toEqual([slug('promo')])
    })

    it('keeps the 429 across instances, per client IP, and accepts the edge IP only from a validated edge', async () => {
      // Fixed clock inside one window, so all requests share it.
      const start = Math.floor(Date.now() / 60_000) * 60_000 + 1_000
      windowEnd = start - 1_000 + DIRECTORY_SEARCH_RATE_LIMIT.windowMs
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(start)
      const limited = ipFor()
      const query = `?q=${marker}`
      const instanceA = search
      const instanceB = await freshInstance()

      // Invalid parameters never consume the window (a NUL in q included).
      for (let index = 0; index < 40; index++)
        expect(
          (
            await instanceA(
              get(index % 2 ? '?q=ab' : '?q=%00%00%00', {
                'x-forwarded-for': limited,
              })
            )
          ).status
        ).toBe(400)
      for (let index = 0; index < DIRECTORY_SEARCH_RATE_LIMIT.max; index++)
        expect(
          (await instanceA(get(query, { 'x-forwarded-for': limited }))).status
        ).toBe(200)

      const refused = await instanceB(
        get(query, { 'x-forwarded-for': limited })
      )
      expect(refused.status).toBe(429)
      expect(refused.headers.get('cache-control')).toBe('no-store')
      expect(refused.headers.get('retry-after')).toBe('59')
      expect(await refused.json()).toEqual({
        error: 'Muitas buscas. Tente novamente em instantes.',
        code: 'RATE_LIMITED',
      })
      expect(
        (await instanceA(get(query, { 'x-forwarded-for': limited }))).status
      ).toBe(429)
      // Another client is not affected.
      expect(
        (await instanceB(get(query, { 'x-forwarded-for': ipFor() }))).status
      ).toBe(200)

      // Behind the proxy the connecting address is the proxy; the validated edge names the client.
      expect(
        (
          await instanceB(
            get(query, { 'x-forwarded-for': limited, ...apexEdge(ipFor()) })
          )
        ).status
      ).toBe(200)
      expect(
        (
          await instanceB(
            get(query, {
              'x-forwarded-for': ipFor(),
              ...apexEdge(limited),
            })
          )
        ).status
      ).toBe(429)
      // A forged edge is ignored: the forwarded address still counts.
      expect(
        (
          await instanceB(
            get(query, {
              'x-forwarded-for': limited,
              ...apexEdge(ipFor(), 'forged-edge-secret-0123456789-0123456789'),
            })
          )
        ).status
      ).toBe(429)

      // Without the shared secret, a new instance keys with its own: the window is per instance.
      vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', '')
      const unshared = await freshInstance()
      expect(
        (await unshared(get(query, { 'x-forwarded-for': limited }))).status
      ).toBe(200)
    })

    it('the outbox cron purge removes only windows expired beyond the grace period', async () => {
      const counter = prismaRateLimitCounter(db)
      const now = Date.now()
      const key = (label: string) => `directory-search:ip:purge${run}:${label}`
      await counter.hit(key('old'), new Date(now - 5 * 60_000))
      await counter.hit(key('grace'), new Date(now - 30_000))
      await counter.hit(key('live'), new Date(now + 60_000))
      expect(
        await purgeExpiredPlatformRateLimits(db, now)
      ).toBeGreaterThanOrEqual(1)
      const left = await db.platformRateLimit.findMany({
        where: { key: { startsWith: `directory-search:ip:purge${run}:` } },
        select: { key: true },
      })
      expect(left.map((row) => row.key).sort()).toEqual([
        key('grace'),
        key('live'),
      ])
      await counter.remove([key('grace'), key('live')])
    })
  }
)
