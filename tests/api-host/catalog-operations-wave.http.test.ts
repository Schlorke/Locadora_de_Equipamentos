import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { PrismaClient, type Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createAdminEquipmentsApi } from '../../packages/frontend/src/pages/equipamentos-admin/api/equipments'
import { parityTargets } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const hosts = parityTargets(context)
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[52]!,
}
let jar: string
let memberships: Array<{ id: string; role: Role }>
const equipmentId = randomUUID()
const rentalIds = [randomUUID(), randomUUID()]
const vehicleIds = [randomUUID(), randomUUID()]
const createdVehicles: string[] = []
const createdDeliveries: string[] = []
const equipment = {
  id: equipmentId,
  tenantId: context.alfa.id,
  categoryId: context.alfa.categoryId,
  name: 'Wave equipment',
  description: 'Wave description',
  pricePerDay: '12.50',
  images: [],
  maxStock: 5,
  available: true,
}
const deliveryInput = {
  rentalId: rentalIds[0],
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
  distance: 0,
  vehicleId: vehicleIds[0],
  driverId: context.drivers.alfa[0],
  notes: '',
}
const endpoints = [
  ['PUT', `equipments/${equipmentId}`],
  ['DELETE', `equipments/${equipmentId}`],
  ['GET', 'vehicles'],
  ['POST', 'vehicles'],
  ['GET', 'logistics'],
  ['POST', 'logistics'],
  ['PATCH', `logistics/${randomUUID()}`],
] as const
async function request(
  host: string,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  const response = await fetch(`${host}/api/admin/${path}`, {
    method,
    headers: {
      ...edge,
      Cookie: jar,
      'x-tenant-id': context.alfa.id,
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(!['GET', 'HEAD', 'OPTIONS'].includes(method)
      ? { body: typeof body === 'string' ? body : JSON.stringify(body ?? {}) }
      : {}),
  })
  const text = await response.text()
  const result = text ? JSON.parse(text) : null
  if (response.status === 201 && result.vehicle)
    createdVehicles.push(result.vehicle.id)
  if (response.status === 201 && result.delivery)
    createdDeliveries.push(result.delivery.id)
  return {
    status: response.status,
    body: result,
    cache: response.headers.get('cache-control'),
    cookie: response.headers.get('set-cookie'),
  }
}
async function cleanupCreated() {
  await prisma.delivery.deleteMany({ where: { id: { in: createdDeliveries } } })
  await prisma.vehicle.deleteMany({ where: { id: { in: createdVehicles } } })
  createdDeliveries.length = 0
  createdVehicles.length = 0
}
/** DTOs completos esperados (sem id e datas gerados), montados da entrada e da fixture (onda 135, B2). */
const expectedDto = {
  equipmentPut(): unknown {
    return {
      tenantId: context.alfa.id,
      categoryId: context.alfa.categoryId,
      name: ' Edited ',
      description: ' Changed ',
      pricePerDay: 19.5,
      images: [],
      available: false,
      isAvailable: false,
      maxStock: 5,
      biweeklyDiscount: 0,
      dailyDiscount: 0,
      monthlyDiscount: 0,
      weeklyDiscount: 0,
      popularPeriod: 'weekly',
      specifications: null,
      biweeklyDirectValue: null,
      dailyDirectValue: null,
      monthlyDirectValue: null,
      weeklyDirectValue: null,
      biweeklyUseDirectValue: false,
      dailyUseDirectValue: false,
      monthlyUseDirectValue: false,
      weeklyUseDirectValue: false,
      dailyRentalEnabled: true,
      weeklyRentalEnabled: true,
      biweeklyRentalEnabled: true,
      monthlyRentalEnabled: true,
      depreciationRate: null,
      hourMeter: null,
      odometer: null,
      purchaseDate: null,
      purchasePrice: null,
      partsLossHistory: null,
      partsLossCount: 0,
      category: {
        tenantId: context.alfa.id,
        name: 'Andaimes',
        slug: 'cat-alfa-' + context.alfa.slug.slice('api-alfa-'.length),
        description: null,
        icon: null,
        placement: null,
        customIcon: null,
        iconColor: '#ea580c',
        bgColor: '#fff7ed',
        fontColor: '#7c2d12',
      },
      _count: { quoteItems: 0, reviews: 0 },
    }
  },
  vehicle(plate: string): unknown {
    return {
      vehicle: {
        tenantId: context.alfa.id,
        plate,
        brand: null,
        model: null,
        year: null,
        type: 'TRUCK',
        status: 'AVAILABLE',
      },
    }
  },
  delivery(): unknown {
    return {
      delivery: {
        tenantId: context.alfa.id,
        rentalId: rentalIds[0],
        type: 'DELIVERY',
        status: 'SCHEDULED',
        scheduledAt: '2026-12-01T10:00:00.000Z',
        completedAt: null,
        address: deliveryInput.address,
        distance: null,
        vehicleId: vehicleIds[0],
        driverId: context.drivers.alfa[0],
        driverName: null,
        photos: [],
        checklist: null,
        notes: '',
        rental: {
          tenantId: context.alfa.id,
          startdate: '2026-01-01T00:00:00.000Z',
          enddate: '2027-01-01T00:00:00.000Z',
          total: '100',
          status: 'ACTIVE',
          userid: context.identity.users[0]!.id,
          createdat: expect.any(String),
          updatedat: expect.any(String),
          checkInAt: null,
          checkOutAt: null,
          extensionDays: null,
          extensionFee: null,
          lateFee: null,
          notes: null,
          quoteId: null,
          clientDeletedAt: null,
          users: null,
        },
      },
    }
  },
  vehicles(): unknown {
    return {
      vehicles: [
        {
          tenantId: context.alfa.id,
          plate: `WAVE-0-${equipmentId}`,
          brand: null,
          model: null,
          year: null,
          type: 'TRUCK',
          status: 'AVAILABLE',
        },
      ],
    }
  },
}
const normalized = (value: unknown) =>
  JSON.parse(JSON.stringify(value), (key, item) =>
    ['id', 'createdAt', 'updatedAt'].includes(key) ? undefined : item
  )
const counts = async () => ({
  vehicles: await prisma.vehicle.count({
    where: { tenantId: context.alfa.id },
  }),
  deliveries: await prisma.delivery.count({
    where: { tenantId: context.alfa.id },
  }),
})
beforeAll(async () => {
  memberships = await prisma.membership.findMany({
    where: { id: { in: context.identity.memberships.slice(0, 2) } },
    select: { id: true, role: true },
  })
  await prisma.membership.updateMany({
    where: { id: { in: memberships.map((row) => row.id) } },
    data: { role: 'ADMIN' },
  })
  jar = await signInParityUser(context, edge, 0)
  await prisma.equipment.create({ data: equipment })
  for (const [index, tenant] of [context.alfa, context.bravo].entries()) {
    await prisma.rentals.create({
      data: {
        id: rentalIds[index]!,
        tenantId: tenant.id,
        userid: context.identity.users[0]!.id,
        startdate: new Date('2026-01-01'),
        enddate: new Date('2027-01-01'),
        total: '100',
        status: 'ACTIVE',
      },
    })
    await prisma.vehicle.create({
      data: {
        id: vehicleIds[index]!,
        tenantId: tenant.id,
        plate: `WAVE-${index}-${equipmentId}`,
      },
    })
  }
})
afterEach(async () => {
  await cleanupCreated()
  await prisma.equipment.upsert({
    where: { id: equipmentId },
    create: equipment,
    update: equipment,
  })
})
afterAll(async () => {
  await cleanupCreated()
  await prisma.equipment.deleteMany({ where: { id: equipmentId } })
  await prisma.rentals.deleteMany({ where: { id: { in: rentalIds } } })
  await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } })
  for (const row of memberships ?? [])
    await prisma.membership.update({
      where: { id: row.id },
      data: { role: row.role },
    })
  await prisma.$disconnect()
  await pool.end()
})

describe('catalog and operations wave with real sessions and RLS', () => {
  it('consumidor de equipamento mantém lista, edição, estoque e posse', async () => {
    for (const host of hosts) {
      const api = createAdminEquipmentsApi(
        createHttpClient({
          baseUrl: host,
          getHeaders: () => ({
            ...edge,
            Cookie: jar,
            'x-tenant-id': context.alfa.id,
            Origin: edge['x-platform-origin'],
            'Sec-Fetch-Site': 'same-origin',
          }),
        })
      )
      expect(await api.get(equipmentId)).toMatchObject({
        ok: true,
        status: 200,
        data: { id: equipmentId, tenantId: context.alfa.id },
      })
      const listed = await api.list<{ equipments: Array<{ id: string }> }>()
      expect(listed.data.equipments.some((row) => row.id === equipmentId)).toBe(
        true
      )
      const response = await api.updateWithText(
        equipmentId,
        JSON.stringify({
          name: ' Edited ',
          description: ' Changed ',
          pricePerDay: 19.5,
          categoryId: context.alfa.categoryId,
          maxStock: 0,
          monthlyRentalEnabled: false,
        })
      )
      expect(response).toMatchObject({ ok: true, status: 200 })
      expect(JSON.parse(response.text)).toMatchObject({
        id: equipmentId,
        name: ' Edited ',
        maxStock: equipment.maxStock,
        monthlyRentalEnabled: false,
      })
      expect(await api.remove(context.bravo.equipmentIds[0]!)).toMatchObject({
        ok: false,
        status: 404,
      })
      expect(await api.remove(equipmentId)).toMatchObject({
        ok: true,
        status: 200,
      })
      await prisma.equipment.create({ data: equipment })
    }
  })
  it.each(endpoints)(
    '%s %s refuses missing session before a malformed body',
    async (method, path) => {
      const before = await counts()
      for (const host of hosts)
        expect(
          (await request(host, method, path, '{', { Cookie: '' })).status
        ).toBe(401)
      expect(await counts()).toEqual(before)
    }
  )
  it.each(endpoints.filter(([method]) => method !== 'GET'))(
    '%s %s enforces same-origin mutation',
    async (method, path) => {
      const before = await counts()
      for (const host of hosts) {
        const response = await request(host, method, path, '{', {
          Origin: 'https://bravo.platform.test',
          'Sec-Fetch-Site': 'same-site',
        })
        expect(response.status).toBe(403)
        expect(response.cache).toBe('no-store')
      }
      expect(await counts()).toEqual(before)
    }
  )
  it('equipment PUT preserves spaces, ignores zero stock, options and full DTO', async () => {
    for (const host of hosts) {
      const response = await request(host, 'PUT', `equipments/${equipmentId}`, {
        name: ' Edited ',
        description: ' Changed ',
        pricePerDay: 19.5,
        categoryId: context.alfa.categoryId,
        isAvailable: false,
        maxStock: 0,
        tenantId: context.bravo.id,
      })
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        id: equipmentId,
        tenantId: context.alfa.id,
        name: ' Edited ',
        description: ' Changed ',
        pricePerDay: 19.5,
        isAvailable: false,
        maxStock: equipment.maxStock,
      })
      expect(normalized(response.body)).toEqual(expectedDto.equipmentPut())
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: equipment,
      })
    }
  })
  it('equipment DELETE only deletes the owned free equipment', async () => {
    for (const host of hosts) {
      const response = await request(
        host,
        'DELETE',
        `equipments/${equipmentId}`,
        '{'
      )
      expect(response).toMatchObject({
        status: 200,
        body: { message: 'Equipamento removido com sucesso' },
        cookie: null,
      })
      expect(
        await prisma.equipment.findUnique({ where: { id: equipmentId } })
      ).toBeNull()
      await prisma.equipment.create({ data: equipment })
    }
  })
  it('referenced equipment deletion rolls back under its existing foreign key', async () => {
    const id = context.alfa.equipmentIds[0]!
    const before = await prisma.equipment.findUniqueOrThrow({ where: { id } })
    for (const host of hosts) {
      expect((await request(host, 'DELETE', `equipments/${id}`)).status).toBe(
        500
      )
      expect(
        await prisma.equipment.findUniqueOrThrow({ where: { id } })
      ).toEqual(before)
    }
  })
  it('vehicle GET uses tenant scope, plate order and status/type filters', async () => {
    for (const host of hosts) {
      const a = await request(
        host,
        'GET',
        'vehicles?status=AVAILABLE&type=TRUCK'
      )
      expect(a.status).toBe(200)
      expect(a.body.vehicles.map((row: { id: string }) => row.id)).toContain(
        vehicleIds[0]
      )
      expect(
        a.body.vehicles.every(
          (row: { tenantId: string }) => row.tenantId === context.alfa.id
        )
      ).toBe(true)
      expect({ ...a, body: normalized(a.body) }).toEqual({
        status: 200,
        body: expectedDto.vehicles(),
        cache: null,
        cookie: null,
      })
    }
  })
  it('vehicle POST preserves defaults, raw plate and same-tenant duplication error', async () => {
    const input = {
      plate: ` Plate-${randomUUID()} `,
      tenantId: context.bravo.id,
      id: 'forged',
    }
    for (const host of hosts) {
      const response = await request(host, 'POST', 'vehicles', input)
      expect(response.status).toBe(201)
      expect(response.body.vehicle).toMatchObject({
        tenantId: context.alfa.id,
        plate: input.plate,
        type: 'TRUCK',
        status: 'AVAILABLE',
        brand: null,
        model: null,
        year: null,
      })
      expect(normalized(response.body)).toEqual(
        expectedDto.vehicle(input.plate)
      )
      expect(await request(host, 'POST', 'vehicles', input)).toMatchObject({
        status: 400,
        body: { error: 'Placa já cadastrada' },
      })
      await cleanupCreated()
    }
  })
  it('vehicle POST validation and malformed JSON keep distinct boundaries', async () => {
    for (const host of hosts) {
      expect(
        (await request(host, 'POST', 'vehicles', { plate: 'OK', year: 1.5 }))
          .status
      ).toBe(400)
      expect((await request(host, 'POST', 'vehicles', '{')).status).toBe(500)
    }
  })
  it('delivery create, listing and PATCH preserve local profile DTO and completion', async () => {
    for (const host of hosts) {
      const created = await request(host, 'POST', 'logistics', {
        ...deliveryInput,
        tenantId: context.bravo.id,
      })
      expect(created.status).toBe(201)
      expect(created.body.delivery).toMatchObject({
        tenantId: context.alfa.id,
        rentalId: rentalIds[0],
        status: 'SCHEDULED',
        distance: null,
        photos: [],
        notes: '',
      })
      expect(normalized(created.body)).toEqual(expectedDto.delivery())
      const id = created.body.delivery.id
      const listed = await request(
        host,
        'GET',
        'logistics?type=DELIVERY&status=SCHEDULED&startDate=2026-11-01&endDate=2026-12-31'
      )
      expect(listed.status).toBe(200)
      expect(
        listed.body.deliveries.some((row: { id: string }) => row.id === id)
      ).toBe(true)
      expect(
        listed.body.deliveries.every(
          (row: { tenantId: string }) => row.tenantId === context.alfa.id
        )
      ).toBe(true)
      const patched = await request(host, 'PATCH', `logistics/${id}`, {
        status: 'COMPLETED',
        vehicleId: null,
        driverId: null,
        driverName: null,
        distance: 0,
        photos: ['fixture.jpg'],
        checklist: { ok: true },
        notes: '',
      })
      expect(patched.status).toBe(200)
      expect(patched.body.delivery).toMatchObject({
        status: 'COMPLETED',
        vehicleId: null,
        driverId: null,
        distance: null,
        photos: ['fixture.jpg'],
        checklist: { ok: true },
      })
      expect(Number.isNaN(Date.parse(patched.body.delivery.completedAt))).toBe(
        false
      )
      await cleanupCreated()
    }
  })
  it.each([
    [{ rentalId: rentalIds[1] }, 'Locação não encontrada'],
    [{ vehicleId: vehicleIds[1] }, 'Veículo não encontrado'],
    [{ driverId: context.drivers.bravo[0] }, 'Motorista não encontrado'],
  ] as const)(
    'foreign reference %j produces neutral 404 and no creation',
    async (patch, error) => {
      const before = await counts()
      for (const host of hosts)
        expect(
          await request(host, 'POST', 'logistics', {
            ...deliveryInput,
            ...patch,
          })
        ).toMatchObject({ status: 404, body: { error } })
      expect(await counts()).toEqual(before)
    }
  )
  it('delivery dates and distances validate before missing-id lookup', async () => {
    for (const host of hosts) {
      expect(
        (
          await request(host, 'POST', 'logistics', {
            ...deliveryInput,
            scheduledAt: 'invalid',
          })
        ).status
      ).toBe(400)
      expect(
        (
          await request(host, 'PATCH', `logistics/${randomUUID()}`, {
            distance: -1,
          })
        ).status
      ).toBe(400)
      expect(
        (
          await request(host, 'PATCH', `logistics/${randomUUID()}`, {
            notes: 'ok',
          })
        ).status
      ).toBe(404)
    }
  })
  it('logistics rejects non-ADMIN membership even with global ADMIN identity', async () => {
    const id = context.identity.memberships[0]!
    try {
      await prisma.membership.update({
        where: { id },
        data: { role: 'OPERATOR' },
      })
      for (const host of hosts)
        for (const [method, path] of endpoints.filter(([, path]) =>
          path.startsWith('logistics')
        ))
          expect((await request(host, method, path, '{')).status).toBe(403)
    } finally {
      await prisma.membership.update({ where: { id }, data: { role: 'ADMIN' } })
    }
  })
})
