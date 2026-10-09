import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const auth = vi.hoisted(() => ({ userId: '' }))
const fixtureDatabase = vi.hoisted(() => ({ prisma: undefined as unknown }))
vi.mock('@/lib/application-session', () => ({
  getServerSession: async () => ({ user: { id: auth.userId } }),
}))
vi.mock('@/lib/prisma', async () => {
  if (!process.env.TEST_DATABASE_URL) return { prisma: undefined }
  const { requireTestDatabase } = await import('../helpers/test-database')
  const { Pool } = await import('pg')
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 5,
  })
  return {
    prisma: (fixtureDatabase.prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    })),
    testPool: pool,
  }
})
// As fixtures (tests/helpers/fixtures.ts) leem o banco pelo runtime do backend (onda 135, E4): o mesmo cliente que a
// fábrica de `@/lib/prisma` acima cria, guardado no momento da criação (sem import cruzado entre os dois dublês).
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: fixtureDatabase.prisma }),
}))
import { prisma } from '@/lib/prisma'
import {
  cleanupTestData,
  createCategory,
  createEquipment,
  createQuoteWithItems,
  createTestTracker,
  createUser,
} from '../helpers/fixtures'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({
    getServerSession: async () => ({ user: { id: auth.userId } }),
  }))()),
}))
import * as legacyRoute0 from '@/app/api/admin/quotes/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/quotes/route'
import * as legacyRoute1 from '@/app/api/admin/quotes/[id]/download/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/quotes/[id]/download/route'
import * as legacyRoute2 from '@/app/api/quotes/[id]/download/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/quotes/[id]/download/route'
import * as legacyRoute3 from '@/app/api/admin/quotes/[id]/adjustments/download/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/quotes/[id]/adjustments/download/route'
import * as legacyRoute4 from '@/app/api/admin/quotes/[id]/calculate-late-fee/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/quotes/[id]/calculate-late-fee/route'

const HOSTS = [
  [
    'legacy root',
    {
      list: legacyRoute0.GET,
      document: legacyRoute1.GET,
      clientDocument: legacyRoute2.GET,
      adjustments: legacyRoute3.GET,
      fee: legacyRoute4.POST,
    },
  ],
  [
    'service',
    {
      list: serviceRoute0.GET,
      document: serviceRoute1.GET,
      clientDocument: serviceRoute2.GET,
      adjustments: serviceRoute3.GET,
      fee: serviceRoute4.POST,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (_host, { list, document, clientDocument, adjustments, fee }) => {
    const a = createTestTracker(),
      b = createTestTracker()
    const params = (id: string) => ({ params: Promise.resolve({ id }) })
    const request = (tenantId: string, query = '', body?: unknown) =>
      new NextRequest('https://app.example.test/api/admin/quotes' + query, {
        method: body ? 'POST' : 'GET',
        headers: {
          'x-tenant-id': tenantId,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    describe.skipIf(!process.env.TEST_DATABASE_URL)(
      'Administrative quotes and real PDF exports',
      () => {
        let quoteA: string, quoteB: string, admin: string, customer: string
        beforeAll(async () => {
          admin = (await createUser(a, { role: 'ADMIN' })).id
          customer = (await createUser(a)).id
          const categoryA = await createCategory(a),
            categoryB = await createCategory(b)
          const equipmentA = await createEquipment(a, categoryA.id),
            equipmentB = await createEquipment(b, categoryB.id)
          quoteA = (
            await createQuoteWithItems(a, {
              equipmentId: equipmentA.id,
              userId: customer,
              status: 'APPROVED',
              startDate: new Date('2030-01-01'),
              endDate: new Date('2030-01-07'),
            })
          ).id
          quoteB = (
            await createQuoteWithItems(b, {
              equipmentId: equipmentB.id,
              status: 'APPROVED',
            })
          ).id
          await prisma.organization.update({
            where: { id: a.tenantId },
            data: { name: 'Tenant A Rentals' },
          })
          await prisma.organization.update({
            where: { id: b.tenantId },
            data: { name: 'Tenant B Rentals' },
          })
          auth.userId = admin
        })
        afterAll(async () => {
          await cleanupTestData(a)
          await cleanupTestData(b)
        })
        it('scopes list, pagination and status totals to the selected locadora', async () => {
          const response = await list(request(a.tenantId))
          expect(response.status).toBe(200)
          const data = await response.json()
          expect(data.quotes.map((q: { id: string }) => q.id)).toEqual([quoteA])
          expect(data.pagination.totalItems).toBe(1)
          expect(data.stats).toMatchObject({ total: 1, approved: 1 })
          expect(response.headers.get('cache-control')).toBe('no-store')
          expect((await list(request(a.tenantId, '?limit=101'))).status).toBe(
            400
          )
          expect(
            (await list(request(a.tenantId, '?status=made-up'))).status
          ).toBe(400)
        })
        it('cannot calculate or export another tenant quote under a valid local admin', async () => {
          for (const handler of [document, adjustments])
            expect(
              (await handler(request(a.tenantId), params(quoteB))).status
            ).toBe(404)
          expect(
            (await fee(request(a.tenantId, '', {}), params(quoteB))).status
          ).toBe(404)
        })
        it('requires a current membership and permission even when global User.role is ADMIN', async () => {
          expect((await list(request(b.tenantId))).status).toBe(403)
          await prisma.membership.update({
            where: { tenantId_userId: { tenantId: a.tenantId, userId: admin } },
            data: { role: 'OPERATOR' },
          })
          expect((await list(request(a.tenantId))).status).toBe(403)
          await prisma.permission.create({
            data: {
              tenantId: a.tenantId,
              role: 'OPERATOR',
              module: 'QUOTES',
              action: 'READ',
            },
          })
          expect((await list(request(a.tenantId))).status).toBe(200)
        })
        it('calculates the characterized fee without mutating approval or financial values', async () => {
          const before = await prisma.quote.findUniqueOrThrow({
            where: { id: quoteA },
          })
          const response = await fee(
            request(a.tenantId, '', {
              currentDate: '2030-01-10T00:00:00.000Z',
            }),
            params(quoteA)
          )
          expect(response.status).toBe(200)
          const data = await response.json()
          expect(data.daysLate).toBe(3)
          expect(data.lateFee).toBeGreaterThan(0)
          const after = await prisma.quote.findUniqueOrThrow({
            where: { id: quoteA },
          })
          expect(after.lateFee).toEqual(before.lateFee)
          expect(after.finalTotal).toEqual(before.finalTotal)
          expect(
            (
              await fee(
                request(a.tenantId, '', {
                  currentDate: 'invalid',
                  config: { dailyRate: -1 },
                }),
                params(quoteA)
              )
            ).status
          ).toBe(400)
        })
        it('returns an actual PDF attributed to the selected locadora, never a success placeholder', async () => {
          const response = await document(request(a.tenantId), params(quoteA))
          expect(response.status).toBe(200)
          expect(response.headers.get('content-type')).toBe('application/pdf')
          const bytes = Buffer.from(await response.arrayBuffer())
          expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
          expect(bytes.toString('latin1')).toContain('Tenant A Rentals')
          expect(bytes.toString('latin1')).not.toContain('Tenant B Rentals')
          expect(response.headers.get('cache-control')).toBe('no-store')
        })
        it('uses the same PDF renderer for the owner, refusing another owner or soft-deleted quote', async () => {
          expect(
            (await clientDocument(request(a.tenantId), params(quoteA))).status
          ).toBe(404)
          auth.userId = customer
          expect(
            (
              await clientDocument(request(a.tenantId), params(quoteA))
            ).headers.get('content-type')
          ).toBe('application/pdf')
          await prisma.quote.update({
            where: { id: quoteA },
            data: { clientDeletedAt: new Date() },
          })
          expect(
            (await clientDocument(request(a.tenantId), params(quoteA))).status
          ).toBe(404)
          auth.userId = admin
        })
        it('exports an existing adjustment and returns 404 when no adjustment exists', async () => {
          expect(
            (await adjustments(request(a.tenantId), params(quoteA))).status
          ).toBe(404)
          await prisma.quoteAdjustment.create({
            data: {
              tenantId: a.tenantId,
              quoteId: quoteA,
              category: 'OTHER',
              amount: 10,
              justification: 'Fixture adjustment',
              createdBy: admin,
            },
          })
          const response = await adjustments(
            request(a.tenantId),
            params(quoteA)
          )
          expect(response.status).toBe(200)
          expect(response.headers.get('content-type')).toBe('application/pdf')
          expect(
            Buffer.from(await response.arrayBuffer())
              .subarray(0, 5)
              .toString()
          ).toBe('%PDF-')
        })
      }
    )
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
