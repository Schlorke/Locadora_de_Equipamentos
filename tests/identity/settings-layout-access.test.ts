import { randomUUID } from 'node:crypto'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

type FixtureSession = { user: { id: string; role: string } } | null
const state = vi.hoisted(() => ({
  session: null as FixtureSession,
  headers: new Headers(),
}))
vi.mock('next/headers', () => ({
  headers: async () => state.headers,
  cookies: async () => ({ getAll: () => [], get: () => undefined }),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
// Both session readers report the same identity, including its global User.role.
vi.mock('@/lib/application-session', () => ({
  getServerSession: async () => state.session,
}))
vi.mock('next-auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getServerSession: async () => state.session,
}))
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
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }) }
})

import { prisma } from '@/lib/prisma'
import SettingsLayout from '@/app/admin/settings/layout'

const base = 'settings-layout-' + randomUUID()
const tenantA = base + '-a'
const tenantB = base + '-b'
const suspended = base + '-suspended'
const globalAdmin = base + '-global-admin'
const tenantAdmin = base + '-tenant-admin'
const children = 'settings-content'

function as(userId: string, globalRole: string, tenantId?: string) {
  state.session = { user: { id: userId, role: globalRole } }
  state.headers = new Headers(
    tenantId ? { cookie: `selected-tenant-id=${tenantId}` } : {}
  )
}
async function render(): Promise<string> {
  try {
    const element = (await SettingsLayout({ children })) as {
      props: { children: unknown }
    }
    return element.props.children === children ? 'rendered' : 'unexpected'
  } catch (error) {
    return (error as Error).message
  }
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
  await prisma.user.createMany({
    data: [
      { id: globalAdmin, email: globalAdmin + '@example.test', role: 'ADMIN' },
      { id: tenantAdmin, email: tenantAdmin + '@example.test', role: 'CLIENT' },
    ],
  })
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
})
beforeEach(() => {
  state.session = null
  state.headers = new Headers()
})
afterAll(async () => {
  const tenants = [tenantA, tenantB, suspended]
  await prisma.membership.deleteMany({ where: { tenantId: { in: tenants } } })
  await prisma.user.deleteMany({
    where: { id: { in: [globalAdmin, tenantAdmin] } },
  })
  await prisma.organization.deleteMany({ where: { id: { in: tenants } } })
  await prisma.$disconnect()
})

describe('admin settings layout (PostgreSQL memberships)', () => {
  it('ignores a global ADMIN role when the selected membership is not ADMIN', async () => {
    as(globalAdmin, 'ADMIN', tenantA)
    expect(await render()).toBe('REDIRECT /admin')
  })
  it('renders for the ADMIN membership of the selected organization', async () => {
    as(tenantAdmin, 'CLIENT', tenantA)
    expect(await render()).toBe('rendered')
  })
  it('does not carry an ADMIN membership into another organization', async () => {
    as(globalAdmin, 'ADMIN', tenantB)
    expect(await render()).toBe('REDIRECT /admin')
  })
  it('rejects revoked memberships and suspended organizations', async () => {
    as(tenantAdmin, 'CLIENT', tenantB)
    expect(await render()).toBe('REDIRECT /admin')
    as(tenantAdmin, 'CLIENT', suspended)
    expect(await render()).toBe('REDIRECT /admin')
  })
  it('requires an explicit organization selection', async () => {
    as(tenantAdmin, 'ADMIN')
    expect(await render()).toBe('REDIRECT /admin')
  })
  it('sends anonymous visitors to the login', async () => {
    state.headers = new Headers({ cookie: `selected-tenant-id=${tenantA}` })
    expect(await render()).toBe('REDIRECT /admin/login')
  })
})
