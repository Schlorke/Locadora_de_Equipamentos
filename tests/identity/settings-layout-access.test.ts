import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
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
import {
  identityRateLimitSecret,
  platformRateLimitDigest,
} from '@gb-locacoes/backend/directory'
import { resolveAdminRoleRedirect } from '../../packages/frontend/src/features/entrar-admin'

// Prepared for the independent F clone. No session, principal, permission or
// auth engine is mocked: sign-in issues the cookie and the service reads it.
// Only Next's request-local context and the disposable database boundary are supplied.
const fixtureState = vi.hoisted(() => {
  const environment: Record<string, string> = {
    NODE_ENV: 'test',
    AUTH_MODE: 'better-auth',
    AUTH_V2_ENABLED: 'false',
    AUTH_CREDENTIAL_WRITES_PAUSED: 'false',
    BETTER_AUTH_URL: 'https://app.settings-fixture.test',
    BETTER_AUTH_SECRET: 'fixture-settings-identity-secret-only-more-than-32',
    NEXTAUTH_URL: 'https://app.settings-fixture.test',
    NEXTAUTH_URL_INTERNAL: 'https://app.settings-fixture.test',
    NEXTAUTH_SECRET: 'fixture-settings-nextauth-secret-only-more-than-32',
    NEXTAUTH_DEBUG: 'false',
    TRUSTED_PROXY_HOPS: '1',
    VERCEL: '',
    PLATFORM_ENV: 'production',
    PLATFORM_ROOT_DOMAIN: 'settings-fixture.test',
    PLATFORM_EDGE_SECRET: 'fixture-settings-edge-secret-only-more-than-32',
    PLATFORM_EDGE_SECRET_PREVIOUS: '',
    PLATFORM_RATE_LIMIT_SECRET:
      'fixture-settings-rate-limit-secret-only-more-than-32',
    PLATFORM_SUBSCRIPTION_ENFORCEMENT: 'off',
    WEB_API_ORIGIN: 'https://api.settings-fixture.test',
    WEB_PUBLIC_ORIGIN: 'https://app.settings-fixture.test',
    AUTH_TRUSTED_ORIGINS: '',
    BETTER_AUTH_TRUSTED_ORIGINS: '',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    FACEBOOK_CLIENT_ID: '',
    FACEBOOK_CLIENT_SECRET: '',
    RESEND_API_KEY: '',
    FROM_EMAIL: 'identity@settings-fixture.test',
    VERCEL_ENV: '',
  }
  const previous = Object.fromEntries(
    Object.keys(environment).map((key) => [key, process.env[key]])
  )
  Object.assign(process.env, environment)
  return {
    environment,
    previous,
    headers: new Headers(),
    database: null as null | {
      prisma: import('@prisma/client').PrismaClient
      pool: import('pg').Pool
    },
    revalidate: vi.fn(),
  }
})

vi.mock('next/headers', () => ({
  headers: async () => fixtureState.headers,
}))
vi.mock('next/cache', () => ({ revalidatePath: fixtureState.revalidate }))
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()
  const { requireTestDatabase } = await import('../helpers/test-database')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 4,
  })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  fixtureState.database = { prisma, pool }
  return { ...actual, getDatabaseRuntime: () => ({ prisma, pool }) }
})

import {
  getServerSession,
  handleIdentityRequest,
} from '../../apps/services/api/src/host/session'
import { resolveTenantPrincipal } from '../../apps/services/api/src/host/private-identity'
import {
  GET,
  PUT,
} from '../../apps/services/api/src/app/api/admin/settings/route'

const { prisma, pool } = fixtureState.database!
const base = 'settings-layout-' + randomUUID()
const tenantA = base + '-a'
const tenantB = base + '-b'
const suspended = base + '-suspended'
const tenants = [tenantA, tenantB, suspended]
const globalAdmin = base + '-global-admin'
const tenantAdmin = base + '-tenant-admin'
const users = [globalAdmin, tenantAdmin]
const origin = fixtureState.environment.BETTER_AUTH_URL!
const password = 'settings-access-fixture-password'
const jars = new Map<string, string>()
const usedIps: string[] = []
const initialEmail = (tenantId: string) => tenantId + '@example.test'
const submittedEmail = base + '-updated@example.test'

function restoreEnvironment() {
  for (const [key, value] of Object.entries(fixtureState.previous)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

async function signIn(userId: string) {
  const ip = `2001:db8:${base.slice(-36, -32)}:${(usedIps.length + 1).toString(16)}::9`
  usedIps.push(ip)
  const response = await handleIdentityRequest(
    new Request(`${origin}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({ email: userId + '@example.test', password }),
    })
  )
  expect(response.status).toBe(200)
  const cookies = response.headers.getSetCookie()
  expect(cookies.some((cookie) => cookie.includes('.session_token='))).toBe(
    true
  )
  jars.set(userId, cookies.map((cookie) => cookie.split(';')[0]!).join('; '))
}

function request(
  method: 'GET' | 'PUT',
  userId: string | null,
  tenantId?: string
) {
  const cookie = [
    userId === null ? '' : jars.get(userId)!,
    tenantId ? `selected-tenant-id=${tenantId}` : '',
  ]
    .filter(Boolean)
    .join('; ')
  const headers = new Headers({ origin, cookie })
  if (method === 'PUT') headers.set('content-type', 'application/json')
  fixtureState.headers = headers
  return new NextRequest(`${origin}/api/admin/settings`, {
    method,
    headers,
    ...(method === 'PUT'
      ? {
          body: JSON.stringify({
            contactEmail: submittedEmail,
            seoTitle: 'Locadora de teste',
            seoDescription: 'Configurações da locadora de teste.',
            themeColorPrimary: '#ea580c',
          }),
        }
      : {}),
  })
}

const snapshot = () =>
  prisma.setting.findMany({
    where: { tenantId: { in: tenants } },
    orderBy: { id: 'asc' },
  })

async function refused(
  userId: string | null,
  tenantId: string | undefined,
  status: number,
  error: string
) {
  const before = await snapshot()
  for (const method of ['GET', 'PUT'] as const) {
    const response = await (method === 'GET' ? GET : PUT)(
      request(method, userId, tenantId)
    )
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error })
    expect(await snapshot()).toEqual(before)
  }
  expect(fixtureState.revalidate).not.toHaveBeenCalled()
}

beforeAll(async () => {
  await prisma.organization.createMany({
    data: [
      { id: tenantA, slug: tenantA, name: 'Locadora A' },
      { id: tenantB, slug: tenantB, name: 'Locadora B' },
      {
        id: suspended,
        slug: suspended,
        name: 'Locadora S',
        status: 'SUSPENDED',
      },
    ],
  })
  const hash = await bcrypt.hash(password, 12)
  for (const [id, role] of [
    [globalAdmin, 'ADMIN'],
    [tenantAdmin, 'CLIENT'],
  ] as const) {
    await prisma.user.create({
      data: {
        id,
        email: id + '@example.test',
        name: 'Settings access fixture',
        role,
        password: hash,
        authEmailVerified: true,
      },
    })
    await prisma.authAccount.create({
      data: {
        userId: id,
        accountId: id,
        providerId: 'credential',
        password: hash,
      },
    })
  }
  await prisma.membership.createMany({
    data: [
      { tenantId: tenantA, userId: globalAdmin, role: 'OPERATOR' },
      { tenantId: tenantA, userId: tenantAdmin, role: 'ADMIN' },
      {
        tenantId: tenantB,
        userId: tenantAdmin,
        role: 'ADMIN',
        status: 'REVOKED',
      },
      { tenantId: suspended, userId: tenantAdmin, role: 'ADMIN' },
    ],
  })
  await prisma.setting.createMany({
    data: tenants.map((tenantId) => ({
      id: tenantId + '-settings',
      tenantId,
      contactEmail: initialEmail(tenantId),
    })),
  })
  await signIn(globalAdmin)
  await signIn(tenantAdmin)
})

beforeEach(() => {
  fixtureState.headers = new Headers()
  fixtureState.revalidate.mockClear()
})

afterAll(async () => {
  try {
    await prisma.setting.deleteMany({ where: { tenantId: { in: tenants } } })
    await prisma.membership.deleteMany({ where: { tenantId: { in: tenants } } })
    await prisma.authSession.deleteMany({ where: { userId: { in: users } } })
    await prisma.authAccount.deleteMany({ where: { userId: { in: users } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    await prisma.organization.deleteMany({ where: { id: { in: tenants } } })
    await prisma.authRateLimit.deleteMany({
      where: {
        key: { contains: `2001:db8:${base.slice(-36, -32)}:` },
      },
    })
    const secret = identityRateLimitSecret(process.env)
    const digests = users.map((id) =>
      platformRateLimitDigest(secret, 'account', id + '@example.test')
    )
    for (const ip of usedIps) {
      const subnet =
        ip
          .split(':')
          .slice(0, 4)
          .map((group) => Number.parseInt(group, 16).toString(16))
          .join(':') + '::/64'
      digests.push(platformRateLimitDigest(secret, 'ip', subnet))
    }
    await prisma.platformRateLimit.deleteMany({
      where: {
        AND: [
          { key: { startsWith: 'auth:sign-in:' } },
          {
            OR: digests.map((digest) => ({ key: { contains: `:${digest}:` } })),
          },
        ],
      },
    })
  } finally {
    try {
      await prisma.$disconnect()
    } finally {
      try {
        await pool.end()
      } finally {
        restoreEnvironment()
      }
    }
  }
})

describe('admin settings access (service session and PostgreSQL memberships)', () => {
  it('ignores a global ADMIN role when the selected membership is not ADMIN', async () => {
    const access = await resolveTenantPrincipal(
      request('GET', globalAdmin, tenantA)
    )
    expect((await getServerSession())?.user?.role).toBe('ADMIN')
    expect(access.ok).toBe(true)
    if (!access.ok) throw new Error('The OPERATOR membership must resolve')
    expect(access.principal.role).toBe('OPERATOR')
    expect(
      resolveAdminRoleRedirect('/admin/settings', access.principal.role)
    ).toBe('/admin')
    await refused(
      globalAdmin,
      tenantA,
      403,
      'Permissão insuficiente nesta locadora'
    )
  })
  it('allows GET and PUT for the ADMIN membership of the selected organization', async () => {
    const access = await resolveTenantPrincipal(
      request('GET', tenantAdmin, tenantA)
    )
    expect((await getServerSession())?.user?.role).toBe('CLIENT')
    expect(access.ok).toBe(true)
    if (!access.ok) throw new Error('The ADMIN membership must resolve')
    expect(access.principal).toMatchObject({
      userId: tenantAdmin,
      tenantId: tenantA,
      role: 'ADMIN',
    })
    expect(
      resolveAdminRoleRedirect('/admin/settings', access.principal.role)
    ).toBeNull()
    const read = await GET(request('GET', tenantAdmin, tenantA))
    expect(read.status).toBe(200)
    expect(read.headers.get('cache-control')).toBe('no-store')
    expect(await read.json()).toMatchObject({
      success: true,
      data: {
        tenantId: tenantA,
        contactEmail: initialEmail(tenantA),
      },
    })
    const write = await PUT(request('PUT', tenantAdmin, tenantA))
    expect(write.status).toBe(200)
    expect(write.headers.get('cache-control')).toBe('no-store')
    expect(await write.json()).toMatchObject({
      success: true,
      data: {
        tenantId: tenantA,
        contactEmail: submittedEmail,
      },
    })
    expect(
      (await prisma.setting.findUniqueOrThrow({ where: { tenantId: tenantA } }))
        .contactEmail
    ).toBe(submittedEmail)
    expect(
      (await prisma.setting.findUniqueOrThrow({ where: { tenantId: tenantB } }))
        .contactEmail
    ).toBe(initialEmail(tenantB))
  })
  it('does not carry an ADMIN membership into another organization', async () => {
    await refused(globalAdmin, tenantB, 403, 'Organization access denied')
  })
  it('rejects revoked memberships and suspended organizations', async () => {
    await refused(tenantAdmin, tenantB, 403, 'Organization access denied')
    await refused(tenantAdmin, suspended, 403, 'Organization access denied')
  })
  it('requires an explicit organization selection', async () => {
    request('GET', tenantAdmin)
    expect((await getServerSession())?.user?.id).toBe(tenantAdmin)
    await refused(tenantAdmin, undefined, 409, 'Select an organization')
  })
  it('refuses anonymous visitors even with an organization cookie', async () => {
    request('GET', null, tenantA)
    expect(await getServerSession()).toBeNull()
    await refused(null, tenantA, 401, 'Authentication required')
  })
})
