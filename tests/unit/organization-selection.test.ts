import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { withTestPlatformTransaction } from '../helpers/platform-fixture'
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
const auth = vi.hoisted(() => ({ userId: null as string | null }))
const fixtureDatabase = vi.hoisted(() => ({
  prisma: undefined as unknown,
  pool: undefined as import('pg').Pool | undefined,
}))
const id = randomUUID()
const userId = 'selection-user-' + id
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()
  if (!process.env.TEST_DATABASE_URL)
    return { ...actual, getDatabaseRuntime: () => ({ prisma: undefined }) }
  const { requireTestDatabase } = await import('../helpers/test-database')
  const { Pool } = await import('pg')
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 4,
  })
  fixtureDatabase.pool = pool
  const fixturePrisma = (fixtureDatabase.prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  }))
  fixtureDatabase.prisma = fixturePrisma
  return { ...actual, getDatabaseRuntime: () => ({ prisma: fixturePrisma }) }
})
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({
    getServerSession: async () =>
      auth.userId ? { user: { id: auth.userId } } : null,
  }))()),
}))
import * as serviceRoute0 from '../../apps/services/api/src/app/api/auth/organizations/selection/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/auth/organizations/route'

const HOSTS = [
  [
    'service',
    {
      GET: serviceRoute0.GET,
      POST: serviceRoute0.POST,
      DELETE: serviceRoute0.DELETE,
      memberships: serviceRoute1.GET,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { GET, POST, DELETE, memberships }) => {
  const tenantA = 'selection-a-' + id,
    tenantB = 'selection-b-' + id,
    tenantC = 'selection-c-' + id
  const request = (
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = {}
  ) =>
    new Request('https://app.example.test/api/auth/organizations/selection', {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  describe.skipIf(!process.env.TEST_DATABASE_URL)(
    'Organization selection with real memberships',
    () => {
      beforeAll(async () => {
        await prisma.organization.createMany({
          data: [tenantA, tenantB, tenantC].map((id) => ({
            id,
            slug: id,
            name: id,
          })),
        })
        await prisma.user.create({
          data: { id: userId, email: userId + '@example.test', role: 'ADMIN' },
        })
        await prisma.membership.createMany({
          data: [
            { tenantId: tenantA, userId, role: 'ADMIN' },
            { tenantId: tenantB, userId, role: 'CLIENT' },
          ],
        })
      })
      beforeEach(async () => {
        auth.userId = userId
        await prisma.membership.updateMany({
          where: { userId },
          data: { status: 'ACTIVE' },
        })
        await withTestPlatformTransaction(prisma, async (tx) =>
          tx.organization.updateMany({
            where: { id: { in: [tenantA, tenantB, tenantC] } },
            data: { status: 'ACTIVE' },
          })
        )
      })
      afterAll(async () => {
        await prisma.membership.deleteMany({ where: { userId } })
        await prisma.user.deleteMany({ where: { id: userId } })
        await prisma.organization.deleteMany({
          where: { id: { in: [tenantA, tenantB, tenantC] } },
        })
      })
      it('never picks the first organization and lists only the current user active memberships', async () => {
        const response = await GET(request())
        expect(await response.json()).toEqual({ selection: null })
        const listing = await memberships()
        const data = await listing.json()
        expect(
          new Set(
            data.memberships.map(
              (entry: { tenant: { id: string } }) => entry.tenant.id
            )
          )
        ).toEqual(new Set([tenantA, tenantB]))
        expect(listing.headers.get('cache-control')).toBe('no-store')
      })
      it('sets a protected preference cookie only after validating the actual per-tenant role', async () => {
        const response = await POST(
          request('POST', { tenantId: tenantB, role: 'ADMIN' })
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({
          selection: { role: 'CLIENT', tenant: { id: tenantB } },
        })
        expect(response.headers.get('set-cookie')).toContain(
          'selected-tenant-id=' + tenantB
        )
        expect(response.headers.get('set-cookie')).toContain(
          'HttpOnly; SameSite=Lax'
        )
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(
          (await POST(request('POST', { tenantId: tenantC }))).status
        ).toBe(403)
      })
      it('revalidates roles and immediately clears revoked or suspended selections', async () => {
        await prisma.membership.update({
          where: { tenantId_userId: { tenantId: tenantB, userId } },
          data: { status: 'REVOKED' },
        })
        const response = await GET(
          request('GET', undefined, { cookie: 'selected-tenant-id=' + tenantB })
        )
        expect(await response.json()).toEqual({ selection: null })
        expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
        expect(
          (await POST(request('POST', { tenantId: tenantB }))).status
        ).toBe(403)
        await withTestPlatformTransaction(prisma, async (tx) =>
          tx.organization.update({
            where: { id: tenantA },
            data: { status: 'SUSPENDED' },
          })
        )
        expect(
          (await POST(request('POST', { tenantId: tenantA }))).status
        ).toBe(403)
        expect(await (await memberships()).json()).toEqual({ memberships: [] })
      })
      it('allows an explicit switch despite the previous cookie and clears selection on logout', async () => {
        const response = await POST(
          request(
            'POST',
            { tenantId: tenantB },
            { cookie: 'selected-tenant-id=' + tenantA }
          )
        )
        expect(await response.json()).toMatchObject({
          selection: { tenant: { id: tenantB } },
        })
        const cleared = await DELETE(request('DELETE'))
        expect(await cleared.json()).toEqual({ selection: null })
        expect(cleared.headers.get('set-cookie')).toContain('Max-Age=0')
      })
      it('rejects ambiguous cookies, conflicting transports and malformed tenant identities', async () => {
        expect(
          (
            await GET(
              request('GET', undefined, {
                cookie: 'selected-tenant-id=' + tenantA,
                'x-tenant-id': tenantB,
              })
            )
          ).status
        ).toBe(400)
        expect(
          (
            await GET(
              request('GET', undefined, {
                cookie:
                  'selected-tenant-id=' +
                  tenantA +
                  '; selected-tenant-id=' +
                  tenantB,
              })
            )
          ).status
        ).toBe(400)
        expect(
          (await POST(request('POST', { tenantId: '../other' }))).status
        ).toBe(400)
        expect((await POST(request('POST', {}))).status).toBe(400)
      })
      it('refuses cross-origin preference mutations and non-JSON forms', async () => {
        expect(
          (
            await POST(
              request(
                'POST',
                { tenantId: tenantA },
                { origin: 'https://evil.example.test' }
              )
            )
          ).status
        ).toBe(403)
        expect(
          (
            await DELETE(
              request('DELETE', undefined, { 'sec-fetch-site': 'cross-site' })
            )
          ).status
        ).toBe(403)
        expect(
          (
            await POST(
              request(
                'POST',
                { tenantId: tenantA },
                { 'content-type': 'text/plain' }
              )
            )
          ).status
        ).toBe(415)
      })
      it('requires authentication for every operation and clears an old preference', async () => {
        auth.userId = null
        for (const [method, handler] of [
          ['GET', GET],
          ['POST', POST],
          ['DELETE', DELETE],
        ] as const) {
          const response = await handler(
            request(
              method,
              method === 'POST' ? { tenantId: tenantA } : undefined
            )
          )
          expect(response.status).toBe(401)
          expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
        }
        expect((await memberships()).status).toBe(401)
      })
    }
  )
})

// O cliente e o pool do banco descartável são da fábrica deste arquivo: fecham uma vez, depois dos dois hosts.
afterAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return
  const database = { prisma, testPool: requireFixturePool() }
  await database.prisma.$disconnect()
  await database.testPool.end()
})

const prisma = getDatabaseRuntime().prisma
function requireFixturePool() {
  const pool = fixtureDatabase.pool
  if (!pool) throw new Error('Owned fixture pool was not initialized')
  return pool
}
