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
import * as legacyRoute0 from '@/app/api/admin/drivers/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/drivers/route'
import * as legacyRoute1 from '@/app/api/admin/logistics/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/logistics/route'
import * as legacyRoute2 from '@/app/api/admin/logistics/[id]/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/logistics/[id]/route'
import * as legacyRoute3 from '@/app/api/admin/maintenance/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/maintenance/route'
import * as legacyRoute4 from '@/app/api/admin/maintenance/[id]/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/maintenance/[id]/route'
import * as legacyRoute5 from '@/app/api/admin/maintenance/[id]/complete/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/admin/maintenance/[id]/complete/route'
import * as legacyRoute6 from '@/app/api/admin/audit-logs/route'
import * as serviceRoute6 from '../../apps/services/api/src/app/api/admin/audit-logs/route'

const HOSTS = [
  [
    'legacy root',
    {
      listDrivers: legacyRoute0.GET,
      createDriver: legacyRoute0.POST,
      addDelivery: legacyRoute1.POST,
      listDeliveries: legacyRoute1.GET,
      patchDelivery: legacyRoute2.PATCH,
      addMaintenance: legacyRoute3.POST,
      patchMaintenance: legacyRoute4.PATCH,
      completeMaintenance: legacyRoute5.POST,
      audit: legacyRoute6.GET,
    },
  ],
  [
    'service',
    {
      listDrivers: serviceRoute0.GET,
      createDriver: serviceRoute0.POST,
      addDelivery: serviceRoute1.POST,
      listDeliveries: serviceRoute1.GET,
      patchDelivery: serviceRoute2.PATCH,
      addMaintenance: serviceRoute3.POST,
      patchMaintenance: serviceRoute4.PATCH,
      completeMaintenance: serviceRoute5.POST,
      audit: serviceRoute6.GET,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      listDrivers,
      createDriver,
      addDelivery,
      listDeliveries,
      patchDelivery,
      addMaintenance,
      patchMaintenance,
      completeMaintenance,
      audit,
    }
  ) => {
    const base = 'ops-' + randomUUID(),
      a = base + '-a',
      b = base + '-b',
      user = base + '-user'
    const eqA = base + '-eq-a',
      eqB = base + '-eq-b',
      rentA = base + '-rent-a',
      rentB = base + '-rent-b'
    const driverA = base + '-driver-a',
      driverB = base + '-driver-b',
      vehicleB = base + '-vehicle-b'
    const maintenanceA = base + '-maintenance-a',
      maintenanceB = base + '-maintenance-b'
    const catA = randomUUID(),
      catB = randomUUID()
    const request = (tenantId: string, body?: object) =>
      new NextRequest('https://test.invalid/api', {
        headers: {
          'x-tenant-id': tenantId,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
      })
    const params = (id: string) => ({ params: Promise.resolve({ id }) })
    const deliveryBody = {
      rentalId: rentA,
      type: 'DELIVERY',
      scheduledAt: '2026-12-01T10:00:00Z',
      address: {
        street: 'Rua',
        number: '1',
        neighborhood: 'Bairro',
        city: 'Cidade',
        state: 'SP',
        zipCode: '01001000',
      },
    }
    beforeAll(async () => {
      session.userId = user
      await prisma.organization.createMany({
        data: [
          { id: a, slug: a, name: 'A' },
          { id: b, slug: b, name: 'B' },
        ],
      })
      await prisma.user.create({
        data: {
          id: user,
          email: user + '@example.test',
          name: 'Identidade global',
          phone: 'global-phone',
          role: 'ADMIN',
        },
      })
      await prisma.membership.createMany({
        data: [
          { tenantId: a, userId: user, role: 'ADMIN' },
          { tenantId: b, userId: user, role: 'CLIENT' },
        ],
      })
      await prisma.clientProfile.create({
        data: {
          tenantId: a,
          userId: user,
          name: 'Cliente da A',
          phone: 'tenant-phone',
        },
      })
      await prisma.category.createMany({
        data: [
          { id: catA, tenantId: a, name: 'Categoria A', slug: 'fixture' },
          { id: catB, tenantId: b, name: 'Categoria B', slug: 'fixture' },
        ],
      })
      await prisma.equipment.createMany({
        data: [
          { id: eqA, tenantId: a, categoryId: catA },
          { id: eqB, tenantId: b, categoryId: catB },
        ].map((row) => ({
          ...row,
          name: 'Fixture',
          pricePerDay: 10,
          images: [],
        })),
      })
      await prisma.rentals.createMany({
        data: [
          { id: rentA, tenantId: a },
          { id: rentB, tenantId: b },
        ].map((row) => ({
          ...row,
          userid: user,
          startdate: new Date('2026-01-01'),
          enddate: new Date('2027-01-01'),
          status: 'ACTIVE',
          total: 100,
        })),
      })
      await prisma.rental_items.create({
        data: {
          id: base + '-item',
          tenantId: a,
          rentalid: rentA,
          equipmentid: eqA,
          quantity: 1,
          priceperday: 10,
          totaldays: 10,
          totalprice: 100,
        },
      })
      await prisma.driver.createMany({
        data: [
          { id: driverA, tenantId: a },
          { id: driverB, tenantId: b },
        ].map((row) => ({ ...row, name: 'Motorista', phone: '0000000000' })),
      })
      await prisma.vehicle.create({
        data: { id: vehicleB, tenantId: b, plate: 'TEST000' },
      })
      await prisma.maintenance.createMany({
        data: [
          { id: maintenanceA, tenantId: a, equipmentId: eqA },
          { id: maintenanceB, tenantId: b, equipmentId: eqB },
        ].map((row) => ({
          ...row,
          type: 'CORRECTIVE',
          scheduledAt: new Date('2026-12-01'),
        })),
      })
      await prisma.auditLog.createMany({
        data: [{ tenantId: a }, { tenantId: b }].map((row) => ({
          ...row,
          userId: user,
          action: 'FIXTURE',
          entity: 'fixture',
          entityId: user,
        })),
      })
    })
    afterAll(async () => {
      const scope = { tenantId: { in: [a, b] } }
      await prisma.delivery.deleteMany({ where: scope })
      await prisma.maintenance.deleteMany({ where: scope })
      await prisma.auditLog.deleteMany({ where: scope })
      await prisma.rental_items.deleteMany({ where: scope })
      await prisma.rentals.deleteMany({ where: scope })
      await prisma.equipment.deleteMany({ where: scope })
      await prisma.category.deleteMany({ where: scope })
      await prisma.driver.deleteMany({ where: scope })
      await prisma.vehicle.deleteMany({ where: scope })
      await prisma.clientProfile.deleteMany({ where: scope })
      await prisma.membership.deleteMany({ where: scope })
      await prisma.organization.deleteMany({ where: { id: { in: [a, b] } } })
      await prisma.user.delete({ where: { id: user } })
    })
    describe('operational handlers against disposable PostgreSQL', () => {
      it('ignores global ADMIN when the selected tenant membership is CLIENT', async () => {
        expect((await listDrivers(request(b))).status).toBe(403)
      })
      it('lists only drivers from the selected tenant', async () => {
        expect(
          (await (await listDrivers(request(a))).json()).drivers.map(
            (row: { id: string }) => row.id
          )
        ).toEqual([driverA])
      })
      it('creates drivers only in the selected tenant through the backend factory', async () => {
        const response = await createDriver(
          request(a, {
            name: 'Novo motorista',
            phone: '11999999999',
            tenantId: b,
            status: 'INACTIVE',
          })
        )
        expect(response.status).toBe(201)
        const { driver } = await response.json()
        expect(driver.tenantId).toBe(a)
        expect(driver.status).toBe('INACTIVE')
        expect(await prisma.driver.count({ where: { tenantId: b } })).toBe(1)
        const persisted = await prisma.driver.findUniqueOrThrow({
          where: { id: driver.id },
        })
        expect(persisted.tenantId).toBe(a)
      })
      it('does not create or complete maintenance for foreign equipment/maintenance', async () => {
        expect(
          (
            await addMaintenance(
              request(a, {
                equipmentId: eqB,
                type: 'CORRECTIVE',
                scheduledAt: '2026-12-01',
              })
            )
          ).status
        ).toBe(404)
        expect(
          (await completeMaintenance(request(a, {}), params(maintenanceB)))
            .status
        ).toBe(404)
        expect(
          (
            await prisma.maintenance.findUniqueOrThrow({
              where: { id: maintenanceB },
            })
          ).status
        ).toBe('SCHEDULED')
      })
      it('preserves availability and scheduled state when equipment has a rental reservation', async () => {
        expect(
          (
            await patchMaintenance(
              request(a, { status: 'IN_PROGRESS' }),
              params(maintenanceA)
            )
          ).status
        ).toBe(400)
        expect(
          (
            await prisma.maintenance.findUniqueOrThrow({
              where: { id: maintenanceA },
            })
          ).status
        ).toBe('SCHEDULED')
        expect(
          (await prisma.equipment.findUniqueOrThrow({ where: { id: eqA } }))
            .available
        ).toBe(true)
      })
      it('atomically marks equipment unavailable at maintenance start and restores it on completion', async () => {
        await prisma.rentals.update({
          where: { id: rentA },
          data: { status: 'COMPLETED' },
        })
        expect(
          (
            await patchMaintenance(
              request(a, { status: 'IN_PROGRESS' }),
              params(maintenanceA)
            )
          ).status
        ).toBe(200)
        expect(
          (await prisma.equipment.findUniqueOrThrow({ where: { id: eqA } }))
            .available
        ).toBe(false)
        expect(
          (
            await completeMaintenance(
              request(a, { hourMeter: 42 }),
              params(maintenanceA)
            )
          ).status
        ).toBe(200)
        const equipment = await prisma.equipment.findUniqueOrThrow({
          where: { id: eqA },
        })
        expect(equipment.available).toBe(true)
        expect(equipment.hourMeter?.toNumber()).toBe(42)
        expect(
          (
            await prisma.maintenance.findUniqueOrThrow({
              where: { id: maintenanceA },
            })
          ).status
        ).toBe('COMPLETED')
      })
      it('rejects cross-tenant rental, driver and vehicle references before writes', async () => {
        for (const extra of [
          { rentalId: rentB },
          { driverId: driverB },
          { vehicleId: vehicleB },
        ])
          expect(
            (await addDelivery(request(a, { ...deliveryBody, ...extra })))
              .status
          ).toBe(404)
        expect(await prisma.delivery.count({ where: { tenantId: a } })).toBe(0)
      })
      it('preserves logistics response shape using tenant client profile', async () => {
        const response = await addDelivery(
          request(a, { ...deliveryBody, driverId: driverA })
        )
        expect(response.status).toBe(201)
        const body = await response.json()
        expect(body.delivery.rental.users).toMatchObject({
          id: user,
          name: 'Cliente da A',
          phone: 'tenant-phone',
        })
        expect((await listDeliveries(request(a))).status).toBe(200)
        expect(
          (
            await patchDelivery(
              request(a, { vehicleId: vehicleB }),
              params(body.delivery.id)
            )
          ).status
        ).toBe(404)
        expect(
          (
            await prisma.delivery.findUniqueOrThrow({
              where: { id: body.delivery.id },
            })
          ).vehicleId
        ).toBeNull()
      })
      it('returns only tenant audit rows', async () => {
        const response = await audit(request(a))
        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.logs).toHaveLength(1)
        expect(body.logs[0].tenantId).toBe(a)
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
