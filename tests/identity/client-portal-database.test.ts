import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
const session = vi.hoisted(() => ({ userId: '' }))
const fixtureDatabase = vi.hoisted(() => ({ prisma: undefined as unknown }))
vi.mock('@/lib/application-session', () => ({
  getServerSession: async () => ({
    user: { id: session.userId, role: 'ADMIN' },
  }),
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
    max: 6,
  })
  return {
    prisma: (fixtureDatabase.prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    })),
    testPool: pool,
  }
})
import { prisma } from '@/lib/prisma'
import { createAdminNotifications } from '@/lib/notification-service'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: fixtureDatabase.prisma }),
}))
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({
    getServerSession: async () => ({
      user: { id: session.userId, role: 'ADMIN' },
    }),
  }))()),
}))
import * as legacyRoute0 from '@/app/api/user/profile/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/user/profile/route'
import * as legacyRoute1 from '@/app/api/client/rentals/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/client/rentals/route'
import * as legacyRoute2 from '@/app/api/client/rentals/[id]/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/client/rentals/[id]/route'
import * as legacyRoute3 from '@/app/api/client/notifications/mark-all-read/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/client/notifications/mark-all-read/route'
import * as legacyRoute4 from '@/app/api/client/rentals/[id]/request-pickup/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/client/rentals/[id]/request-pickup/route'

const HOSTS = [
  [
    'legacy root',
    {
      getProfile: legacyRoute0.GET,
      putProfile: legacyRoute0.PUT,
      listRentals: legacyRoute1.GET,
      readRental: legacyRoute2.GET,
      deleteRental: legacyRoute2.DELETE,
      markAll: legacyRoute3.POST,
      pickup: legacyRoute4.POST,
    },
  ],
  [
    'service',
    {
      getProfile: serviceRoute0.GET,
      putProfile: serviceRoute0.PUT,
      listRentals: serviceRoute1.GET,
      readRental: serviceRoute2.GET,
      deleteRental: serviceRoute2.DELETE,
      markAll: serviceRoute3.POST,
      pickup: serviceRoute4.POST,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      getProfile,
      putProfile,
      listRentals,
      readRental,
      deleteRental,
      markAll,
      pickup,
    }
  ) => {
    const base = 'portal-' + randomUUID()
    const a = base + '-a',
      b = base + '-b',
      owner = base + '-owner',
      other = base + '-other',
      admin = base + '-admin'
    const rentalA = base + '-rental-a',
      rentalB = base + '-rental-b',
      rentalOther = base + '-rental-other'
    const request = (tenantId: string, body?: object) =>
      new NextRequest('https://test.invalid/api', {
        headers: {
          'x-tenant-id': tenantId,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
      })
    const params = (id: string) => ({ params: Promise.resolve({ id }) })
    beforeAll(async () => {
      session.userId = owner
      await prisma.organization.createMany({
        data: [
          { id: a, slug: a, name: 'Locadora A' },
          { id: b, slug: b, name: 'Locadora B' },
        ],
      })
      await prisma.user.createMany({
        data: [owner, other, admin].map((id) => ({
          id,
          email: id + '@example.test',
          role: 'ADMIN',
          phone: 'global-unchanged',
        })),
      })
      await prisma.membership.createMany({
        data: [
          { tenantId: a, userId: owner, role: 'CLIENT' },
          { tenantId: b, userId: owner, role: 'CLIENT' },
          { tenantId: a, userId: other, role: 'CLIENT' },
          { tenantId: a, userId: admin, role: 'ADMIN' },
          { tenantId: b, userId: admin, role: 'CLIENT' },
        ],
      })
      await prisma.clientProfile.createMany({
        data: [
          {
            tenantId: a,
            userId: owner,
            name: 'Cliente A',
            phone: 'a-original',
          },
          {
            tenantId: b,
            userId: owner,
            name: 'Cliente B',
            phone: 'b-original',
          },
        ],
      })
      await prisma.rentals.createMany({
        data: [
          { id: rentalA, tenantId: a, userid: owner },
          { id: rentalB, tenantId: b, userid: owner },
          { id: rentalOther, tenantId: a, userid: other },
        ].map((row) => ({
          ...row,
          status: 'ACTIVE',
          total: 100,
          startdate: new Date('2026-01-01'),
          enddate: new Date('2027-01-01'),
        })),
      })
      await prisma.notification.createMany({
        data: [
          { tenantId: a, userId: owner },
          { tenantId: b, userId: owner },
          { tenantId: a, userId: other },
        ].map((row) => ({
          ...row,
          type: 'SYSTEM',
          title: 'Fixture',
          message: 'Fixture',
        })),
      })
    })
    afterAll(async () => {
      const scope = { tenantId: { in: [a, b] } }
      await prisma.notification.deleteMany({ where: scope })
      await prisma.auditLog.deleteMany({ where: scope })
      await prisma.rentals.deleteMany({ where: scope })
      await prisma.clientProfile.deleteMany({ where: scope })
      await prisma.membership.deleteMany({ where: scope })
      await prisma.organization.deleteMany({ where: { id: { in: [a, b] } } })
      await prisma.user.deleteMany({
        where: { id: { in: [owner, other, admin] } },
      })
    })
    describe('client portal handlers with disposable PostgreSQL', () => {
      it('separates two tenant profiles from the global identity', async () => {
        expect(await (await getProfile(request(a))).json()).toMatchObject({
          user: { name: 'Cliente A' },
        })
        expect(await (await getProfile(request(b))).json()).toMatchObject({
          user: { name: 'Cliente B' },
        })
        expect(
          (await putProfile(request(a, { phone: '11999999999' }))).status
        ).toBe(200)
        expect(
          (
            await prisma.clientProfile.findUniqueOrThrow({
              where: { tenantId_userId: { tenantId: b, userId: owner } },
            })
          ).phone
        ).toBe('b-original')
        expect(
          (await prisma.user.findUniqueOrThrow({ where: { id: owner } })).phone
        ).toBe('global-unchanged')
      })
      it('does not grant global ADMIN access to another tenant or owner rental', async () => {
        const result = await (await listRentals(request(a))).json()
        expect(result.rentals.map((row: { id: string }) => row.id)).toEqual([
          rentalA,
        ])
        expect((await readRental(request(a), params(rentalB))).status).toBe(404)
        expect((await readRental(request(a), params(rentalOther))).status).toBe(
          404
        )
        expect((await deleteRental(request(a), params(rentalB))).status).toBe(
          404
        )
        expect(
          (await prisma.rentals.findUniqueOrThrow({ where: { id: rentalB } }))
            .clientDeletedAt
        ).toBeNull()
      })
      it('marks only the selected tenant recipient notifications', async () => {
        expect((await markAll(request(a))).status).toBe(200)
        expect(
          await prisma.notification.count({
            where: { tenantId: a, userId: owner, isRead: true },
          })
        ).toBe(1)
        expect(
          await prisma.notification.count({
            where: { tenantId: b, userId: owner, isRead: true },
          })
        ).toBe(0)
        expect(
          await prisma.notification.count({
            where: { tenantId: a, userId: other, isRead: true },
          })
        ).toBe(0)
      })
      it('observes revoked memberships immediately despite an existing session', async () => {
        await prisma.membership.update({
          where: { tenantId_userId: { tenantId: a, userId: owner } },
          data: { status: 'REVOKED' },
        })
        try {
          expect((await listRentals(request(a))).status).toBe(403)
        } finally {
          await prisma.membership.update({
            where: { tenantId_userId: { tenantId: a, userId: owner } },
            data: { status: 'ACTIVE' },
          })
        }
      })
      it('persists one pickup request and one local admin alert under concurrent retries', async () => {
        const responses = await Promise.all([
          pickup(request(a), params(rentalA)),
          pickup(request(a), params(rentalA)),
        ])
        expect(responses.map((row) => row.status)).toEqual([200, 200])
        const bodies = await Promise.all(responses.map((row) => row.json()))
        expect(bodies[0].requestId).toBe(bodies[1].requestId)
        expect(
          await prisma.auditLog.count({
            where: {
              tenantId: a,
              action: 'CLIENT_RENTAL_REQUEST',
              entityId: rentalA,
            },
          })
        ).toBe(1)
        expect(
          await prisma.notification.count({
            where: { tenantId: a, userId: admin, type: 'RENTAL' },
          })
        ).toBe(1)
        expect(
          await prisma.notification.count({
            where: { tenantId: b, userId: admin, type: 'RENTAL' },
          })
        ).toBe(0)
        expect(
          (await prisma.rentals.findUniqueOrThrow({ where: { id: rentalA } }))
            .status
        ).toBe('ACTIVE')
      })
      it('filters global admins by current tenant membership and dedupes concurrent fanout', async () => {
        const input = {
          type: 'SYSTEM' as const,
          title: 'Tenant notice',
          message: 'Tenant notice',
          dedupeKey: 'fixture',
        }
        const results = await Promise.all([
          createAdminNotifications({ tenantId: a }, input),
          createAdminNotifications({ tenantId: a }, input),
        ])
        expect(results.reduce((sum, row) => sum + row.count, 0)).toBe(1)
        expect(
          await prisma.notification.count({
            where: { tenantId: a, title: 'Tenant notice', userId: owner },
          })
        ).toBe(0)
        expect(await createAdminNotifications({ tenantId: b }, input)).toEqual({
          count: 0,
        })
      })
    })
  }
)

// O cliente e o pool do banco descartável são da fábrica deste arquivo: fecham uma vez, depois dos dois hosts.
afterAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return
  const database = (await import('@/lib/prisma')) as unknown as {
    prisma: { $disconnect(): Promise<void> }
    testPool: { end(): Promise<void> }
  }
  await database.prisma.$disconnect()
  await database.testPool.end()
})
