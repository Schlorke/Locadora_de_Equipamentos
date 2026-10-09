import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const hosts = parityTargets(context)
const rentalIds = Array.from({ length: 3 }, () => randomUUID())
const quoteIds = Array.from({ length: 4 }, () => randomUUID())
const quoteItemIds = Array.from({ length: 4 }, () => randomUUID())
const rentalItemIds = Array.from({ length: 3 }, () => randomUUID())
const adminMembership = randomUUID()
const activityPaymentId = randomUUID()
const marker = `cycle-${randomUUID()}`
const manualIds = new Set<string>()
const start = new Date('2031-03-01T00:00:00Z')
const end = new Date('2031-03-04T00:00:00Z')
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[51]!,
}
let originalClientMembership: Pick<
  Awaited<ReturnType<typeof prisma.membership.findUniqueOrThrow>>,
  'role' | 'status'
>
let clientJar: string
let adminJar: string
const endpoints = [
  ['GET', '/api/quotes'],
  ['GET', '/api/client/activities'],
  ['GET', '/api/admin/rentals'],
  ['GET', `/api/admin/rentals/${rentalIds[0]}`],
  ['POST', '/api/admin/rentals'],
  ['PATCH', `/api/admin/rentals/${rentalIds[0]}`],
  ['DELETE', `/api/admin/rentals/${rentalIds[0]}`],
  ['POST', `/api/admin/rentals/${rentalIds[0]}/checkout`],
  ['POST', `/api/admin/rentals/${rentalIds[0]}/checkin`],
  ['POST', `/api/admin/rentals/${rentalIds[0]}/extend`],
  ['POST', `/api/admin/rentals/${rentalIds[0]}/calculate-late-fee`],
  ['POST', `/api/client/rentals/${rentalIds[0]}/extend`],
] as const
async function request(
  host: string,
  method: string,
  path: string,
  body?: unknown,
  jar = adminJar,
  headers: Record<string, string> = {}
) {
  const response = await fetch(host + path, {
    method,
    headers: {
      ...edge,
      Cookie: jar,
      'x-tenant-id': context.alfa.id,
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(method !== 'GET'
      ? { body: typeof body === 'string' ? body : JSON.stringify(body ?? {}) }
      : {}),
  })
  return {
    status: response.status,
    body: await response.json(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
  }
}
async function snapshot() {
  return {
    rentals: await prisma.rentals.findMany({
      where: { id: { in: rentalIds } },
      orderBy: { id: 'asc' },
    }),
    items: await prisma.rental_items.findMany({
      where: { rentalid: { in: rentalIds } },
      orderBy: { id: 'asc' },
    }),
    payments: await prisma.payment.findMany({
      where: { rentalId: { in: rentalIds } },
      orderBy: { id: 'asc' },
    }),
    outbox: await prisma.outboxEvent.findMany({
      where: {
        tenantId: context.alfa.id,
        aggregateId: {
          in: (
            await prisma.payment.findMany({
              where: { rentalId: { in: rentalIds } },
              select: { id: true },
            })
          ).map((row) => row.id),
        },
      },
      orderBy: { id: 'asc' },
    }),
  }
}
async function clearCharges() {
  const payments = await prisma.payment.findMany({
    where: { rentalId: { in: [...rentalIds, ...manualIds] } },
    select: { id: true },
  })
  await prisma.outboxEvent.deleteMany({
    where: { aggregateId: { in: payments.map((row) => row.id) } },
  })
  await prisma.payment.deleteMany({
    where: { rentalId: { in: [...rentalIds, ...manualIds] } },
  })
}
async function restore() {
  await clearCharges()
  await prisma.rentals.deleteMany({ where: { id: { in: [...manualIds] } } })
  manualIds.clear()
  await prisma.clientDocument.deleteMany({
    where: { tenantId: context.alfa.id, userId: context.identity.users[0]!.id },
  })
  await prisma.rentals.update({
    where: { id: rentalIds[0]! },
    data: {
      status: 'ACTIVE',
      startdate: start,
      enddate: end,
      extensionDays: 0,
      extensionFee: null,
      lateFee: null,
      checkInAt: null,
      checkOutAt: null,
      clientDeletedAt: null,
      notes: marker,
    },
  })
  await prisma.rental_items.updateMany({
    where: { rentalid: rentalIds[0]! },
    data: { startDate: start, endDate: end },
  })
  await prisma.quote.update({
    where: { id: quoteIds[0]! },
    data: { status: 'APPROVED', paymentTerms: 'AT_END', clientDeletedAt: null },
  })
  await prisma.membership.update({
    where: { id: context.identity.memberships[0]! },
    data: { status: 'ACTIVE', role: 'CLIENT' },
  })
  await prisma.membership.update({
    where: { id: adminMembership },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
}
async function documents(tenantId = context.alfa.id) {
  for (const type of [
    'ID_DOCUMENT',
    'SELFIE',
    'SIGNED_CONTRACT',
    'CPF_CNPJ_PROOF',
  ] as const)
    await prisma.clientDocument.create({
      data: {
        tenantId,
        userId: context.identity.users[0]!.id,
        type,
        filePath: `${tenantId}/fixture/${randomUUID()}`,
        fileName: 'fixture.pdf',
        mimeType: 'application/pdf',
        fileSize: 1,
        uploadedBy: context.identity.users[0]!.id,
      },
    })
}
beforeAll(async () => {
  originalClientMembership = await prisma.membership.findUniqueOrThrow({
    where: { id: context.identity.memberships[0]! },
    select: { role: true, status: true },
  })
  clientJar = await signInParityUser(context, edge, 0)
  adminJar = await signInParityUser(context, edge, 1)
  await prisma.membership.create({
    data: {
      id: adminMembership,
      tenantId: context.alfa.id,
      userId: context.identity.users[1]!.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
  for (let index = 0; index < 4; index++) {
    const tenant = index === 3 ? context.bravo : context.alfa
    const userId = context.identity.users[index === 2 ? 1 : 0]!.id
    await prisma.quote.create({
      data: {
        id: quoteIds[index]!,
        tenantId: tenant.id,
        userId,
        name: marker,
        email: 'cycle@example.test',
        phone: 'fixture',
        total: '100.50',
        finalTotal: '100.50',
        status: 'APPROVED',
        paymentTerms: 'AT_END',
        startDate: start,
        endDate: end,
        createdAt: new Date('2032-02-01'),
        approvedAt: new Date('2032-02-02'),
        clientDeletedAt: index === 1 ? new Date('2032-02-03') : null,
        items: {
          create: {
            id: quoteItemIds[index],
            tenantId: tenant.id,
            equipmentId: tenant.equipmentIds[0]!,
            pricePerDay: '10.50',
            total: '63',
            quantity: 2,
            days: 3,
            startDate: start,
            endDate: end,
          },
        },
      },
    })
  }
  for (let index = 0; index < 3; index++) {
    const tenant = index === 2 ? context.bravo : context.alfa
    await prisma.rentals.create({
      data: {
        id: rentalIds[index]!,
        tenantId: tenant.id,
        userid: context.identity.users[index === 1 ? 1 : 0]!.id,
        quoteId: quoteIds[index === 0 ? 0 : index + 1]!,
        total: '100.50',
        status: 'ACTIVE',
        startdate: start,
        enddate: end,
        createdat: new Date('2032-02-04'),
        updatedat: new Date('2032-02-05'),
        notes: marker,
        rental_items: {
          create: {
            id: rentalItemIds[index]!,
            tenantId: tenant.id,
            equipmentid: tenant.equipmentIds[index === 1 ? 1 : 0]!,
            quantity: index === 1 ? 1 : 2,
            priceperday: '10.50',
            totaldays: 3,
            totalprice: '63',
            startDate: start,
            endDate: end,
          },
        },
      },
    })
  }
})
beforeEach(restore)
afterAll(async () => {
  await clearCharges()
  await prisma.clientDocument.deleteMany({
    where: { userId: context.identity.users[0]!.id },
  })
  await prisma.rentals.deleteMany({
    where: { id: { in: [...rentalIds, ...manualIds] } },
  })
  await prisma.quote.deleteMany({ where: { id: { in: quoteIds } } })
  await prisma.membership.deleteMany({ where: { id: adminMembership } })
  await prisma.membership.update({
    where: { id: context.identity.memberships[0]! },
    data: originalClientMembership,
  })
  await prisma.$disconnect()
  await pool.end()
})

/** Respostas completas esperadas do ciclo de locação, montadas da fixture deste arquivo (onda 135, B2). */
function expectedCycleEquipment() {
  return {
    id: context.alfa.equipmentIds[0],
    tenantId: context.alfa.id,
    categoryId: context.alfa.categoryId,
    name: 'Betoneira alfa 00',
    description: 'Concreto alfa',
    pricePerDay: '12.5',
    images: ['https://assets.example.test/alfa.jpg'],
    available: true,
    maxStock: 3,
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: expect.any(String),
    biweeklyDiscount: 0,
    dailyDiscount: 0,
    monthlyDiscount: 0,
    weeklyDiscount: 0,
    popularPeriod: 'weekly',
    specifications: { internal: 'fixture-private' },
    biweeklyDirectValue: null,
    dailyDirectValue: '17.25',
    monthlyDirectValue: null,
    weeklyDirectValue: null,
    biweeklyUseDirectValue: false,
    dailyUseDirectValue: true,
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
    purchasePrice: '99999',
    partsLossHistory: { internal: 'fixture-private' },
    partsLossCount: 0,
    category: { id: context.alfa.categoryId, name: 'Andaimes' },
  }
}
function expectedCycleItem(detail: boolean) {
  return {
    id: rentalItemIds[0],
    tenantId: context.alfa.id,
    rentalid: rentalIds[0],
    equipmentid: context.alfa.equipmentIds[0],
    quantity: 2,
    priceperday: '10.5',
    totaldays: 3,
    totalprice: '63',
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    includeWeekends: false,
    createdat: expect.any(String),
    updatedat: expect.any(String),
    equipments: detail
      ? expectedCycleEquipment()
      : {
          id: context.alfa.equipmentIds[0],
          name: 'Betoneira alfa 00',
          images: ['https://assets.example.test/alfa.jpg'],
        },
  }
}
function expectedCycleRawQuote() {
  return {
    id: quoteIds[0],
    tenantId: context.alfa.id,
    userId: context.identity.users[0]!.id,
    quoteCode: null,
    legacyExternalCode: null,
    name: marker,
    email: 'cycle@example.test',
    phone: 'fixture',
    company: null,
    message: null,
    total: '100.5',
    status: 'APPROVED',
    clientDeletedAt: null,
    createdAt: '2032-02-01T00:00:00.000Z',
    updatedAt: expect.any(String),
    cep: null,
    cnpj: null,
    cpf: null,
    adminNotes: null,
    approvedAt: '2032-02-02T00:00:00.000Z',
    approvedBy: null,
    convertedToRentalId: null,
    paymentTerms: 'AT_END',
    deliveryAddress: null,
    deliveryFee: null,
    deliveryType: null,
    deposit: null,
    discount: null,
    endDate: end.toISOString(),
    finalTotal: '100.5',
    internalNotes: null,
    pickupFee: null,
    priority: 0,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    startDate: start.toISOString(),
    subtotal: null,
    taxes: null,
    validUntil: null,
    originalTotal: null,
    priceAdjustmentReason: null,
    priceAdjustedAt: null,
    priceAdjustedBy: null,
    lateFee: null,
    lateFeeApproved: false,
    lateFeeApprovedAt: null,
    lateFeeApprovedBy: null,
    damages: null,
    misuse: null,
    operationType: null,
    serviceAmount: null,
    items: [
      {
        id: quoteItemIds[0],
        tenantId: context.alfa.id,
        quoteId: quoteIds[0],
        equipmentId: context.alfa.equipmentIds[0],
        quantity: 2,
        days: 3,
        pricePerDay: '10.5',
        total: '63',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        includeWeekends: false,
        appliedDiscount: null,
        appliedPeriod: null,
        useDirectValue: false,
        directValue: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        equipment: {
          id: context.alfa.equipmentIds[0],
          name: 'Betoneira alfa 00',
        },
      },
    ],
  }
}
function expectedCycleRental(detail: boolean) {
  return {
    id: rentalIds[0],
    tenantId: context.alfa.id,
    userid: context.identity.users[0]!.id,
    quoteId: quoteIds[0],
    startdate: start.toISOString(),
    enddate: end.toISOString(),
    total: '100.5',
    status: 'ACTIVE',
    createdat: '2032-02-04T00:00:00.000Z',
    updatedat: '2032-02-05T00:00:00.000Z',
    checkInAt: null,
    checkOutAt: null,
    extensionDays: 0,
    extensionFee: null,
    lateFee: null,
    notes: marker,
    clientDeletedAt: null,
    users: {
      id: context.identity.users[0]!.id,
      name: 'fixture-private-customer',
      email: context.identity.users[0]!.email,
      phone: null,
      ...(detail ? { cpf: null, cnpj: null } : {}),
    },
    rental_items: [expectedCycleItem(detail)],
    payments: [],
    ...(detail
      ? { quote: expectedCycleRawQuote(), deliveries: [] }
      : {
          quote: {
            id: quoteIds[0],
            name: marker,
            email: 'cycle@example.test',
            company: null,
            status: 'APPROVED',
          },
          contract: null,
        }),
  }
}
// Next's App Router adds these cache variants before route-specific Vary fields.
const appRouterVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
const expectedCycle = {
  clientQuotes(): unknown {
    return {
      status: 200,
      cache: 'private, no-store',
      vary: `${appRouterVary}, Cookie, x-tenant-id`,
      body: [
        {
          id: quoteIds[0],
          quoteCode: null,
          legacyExternalCode: null,
          paymentTerms: 'AT_END',
          name: marker,
          email: 'cycle@example.test',
          phone: 'fixture',
          company: null,
          deliveryAddress: null,
          deliveryType: null,
          totalPrice: 100.5,
          originalTotal: 100.5,
          finalTotal: 100.5,
          priceAdjustmentReason: null,
          priceAdjustedAt: null,
          lateFee: null,
          lateFeeApproved: false,
          status: 'approved',
          payments: [],
          createdAt: '2032-02-01T00:00:00.000Z',
          updatedAt: expect.any(String),
          validUntil: null,
          items: [
            {
              id: quoteItemIds[0],
              quantity: 2,
              days: 3,
              startDate: start.toISOString(),
              endDate: end.toISOString(),
              pricePerDay: 10.5,
              total: 63,
              equipment: {
                id: context.alfa.equipmentIds[0],
                name: 'Betoneira alfa 00',
              },
            },
          ],
        },
      ],
    }
  },
  activities(): unknown {
    const rentalCode = rentalIds[0]!.slice(-8).toUpperCase()
    const quoteCode = quoteIds[0]!.slice(-8).toUpperCase()
    return {
      status: 200,
      cache: null,
      vary: appRouterVary,
      body: {
        activities: [
          {
            id: `payment-${activityPaymentId}`,
            type: 'payment_made',
            title: 'Pagamento realizado',
            description: 'Pagamento de R$\u00a010,50 via PIX',
            timestamp: '2032-02-06T00:00:00.000Z',
            link: `/area-cliente/historico/${rentalIds[0]}`,
            metadata: { amount: 10.5, status: 'PAID' },
          },
          {
            id: `rental-updated-${rentalIds[0]}-${new Date('2032-02-05').getTime()}`,
            type: 'rental_updated',
            title: 'Locação atualizada',
            description: `Status da locação #${rentalCode} alterado para ACTIVE`,
            timestamp: '2032-02-05T00:00:00.000Z',
            link: `/area-cliente/historico/${rentalIds[0]}`,
            metadata: { status: 'ACTIVE' },
          },
          {
            id: `rental-created-${rentalIds[0]}`,
            type: 'rental_created',
            title: 'Locação iniciada',
            description: `Locação #${rentalCode} com 1 equipamento(s)`,
            timestamp: '2032-02-04T00:00:00.000Z',
            link: `/area-cliente/historico/${rentalIds[0]}`,
            metadata: { amount: 100.5, status: 'ACTIVE', itemCount: 1 },
          },
          {
            id: `quote-approved-${quoteIds[0]}`,
            type: 'quote_approved',
            title: 'Orçamento aprovado',
            description: `Orçamento #${quoteCode} foi aprovado`,
            timestamp: '2032-02-02T00:00:00.000Z',
            link: '/area-cliente/historico',
            metadata: { amount: 100.5 },
          },
        ],
      },
    }
  },
  adminList(): unknown {
    return {
      status: 200,
      cache: null,
      vary: appRouterVary,
      body: {
        rentals: [expectedCycleRental(false)],
        pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
      },
    }
  },
  adminDetail(): unknown {
    return {
      status: 200,
      cache: null,
      vary: appRouterVary,
      body: { rental: expectedCycleRental(true) },
    }
  },
}
describe('rental cycle: real HTTP, sessions, transaction and queued billing', () => {
  it.each(endpoints)(
    '%s %s requires a session before parsing',
    async (method, path) => {
      const before = await snapshot()
      for (const host of hosts)
        expect((await request(host, method, path, '{', '')).status).toBe(401)
      expect(await snapshot()).toEqual(before)
    }
  )
  it.each(endpoints.filter(([method]) => method !== 'GET'))(
    '%s %s rejects sibling-origin mutation before effect',
    async (method, path) => {
      const before = await snapshot()
      for (const host of hosts)
        expect(
          (
            await request(host, method, path, '{', '', {
              Origin: 'https://bravo.platform.test',
              'Sec-Fetch-Site': 'same-site',
            })
          ).status
        ).toBe(403)
      expect(await snapshot()).toEqual(before)
    }
  )
  it.each(endpoints.filter(([, path]) => path.startsWith('/api/admin/')))(
    '%s %s does not confer ADMIN from the global user',
    async (method, path) => {
      const before = await snapshot()
      for (const host of hosts)
        expect((await request(host, method, path, '{', clientJar)).status).toBe(
          403
        )
      expect(await snapshot()).toEqual(before)
    }
  )
  it('preserves the client quote list DTO, ownership, hidden rows and private headers', async () => {
    for (const host of hosts)
      expect(
        await request(host, 'GET', '/api/quotes', undefined, clientJar)
      ).toEqual(expectedCycle.clientQuotes())
    const response = await request(
      hosts.at(-1)!,
      'GET',
      '/api/quotes',
      undefined,
      clientJar
    )
    expect(response.status).toBe(200)
    expect(response.cache).toBe('private, no-store')
    expect(
      response.vary?.split(/,\s*/).map((header) => header.toLowerCase())
    ).toEqual(expect.arrayContaining(['cookie', 'x-tenant-id']))
    const rows = response.body as {
      id: string
      totalPrice: number
      status: string
      items: {
        pricePerDay: number
        total: number
        equipment: Record<string, unknown>
      }[]
    }[]
    expect(rows.map((row) => row.id)).toContain(quoteIds[0])
    for (const hiddenOrForeignId of quoteIds.slice(1))
      expect(rows.map((row) => row.id)).not.toContain(hiddenOrForeignId)
    const own = rows.find((row) => row.id === quoteIds[0])!
    expect(own).toMatchObject({
      totalPrice: 100.5,
      finalTotal: 100.5,
      status: 'approved',
    })
    expect(own.items[0]).toMatchObject({ pricePerDay: 10.5, total: 63 })
    expect(Object.keys(own.items[0]!.equipment).sort()).toEqual(['id', 'name'])
  })
  it.each(['0', '-1', '101', '1.5', 'nope'])(
    'rejects invalid activity limit %s',
    async (limit) => {
      for (const host of hosts)
        expect(
          await request(
            host,
            'GET',
            `/api/client/activities?limit=${limit}`,
            undefined,
            clientJar
          )
        ).toMatchObject({ status: 400, body: { error: 'Limite inválido' } })
    }
  )
  it('preserves activity events, amount, sorting, limit and hidden-owner isolation', async () => {
    await prisma.payment.create({
      data: {
        id: activityPaymentId,
        tenantId: context.alfa.id,
        rentalId: rentalIds[0],
        amount: '10.50',
        method: 'PIX',
        status: 'PAID',
        dueDate: end,
        paidAt: new Date('2032-02-06'),
      },
    })
    for (const host of hosts)
      expect(
        await request(
          host,
          'GET',
          '/api/client/activities?limit=4',
          undefined,
          clientJar
        )
      ).toEqual(expectedCycle.activities())
    const result = await request(
      hosts.at(-1)!,
      'GET',
      '/api/client/activities?limit=4',
      undefined,
      clientJar
    )
    expect(result.status).toBe(200)
    const events = result.body.activities as {
      id: string
      timestamp: string
      metadata: { amount?: number; status?: string }
    }[]
    expect(events).toHaveLength(4)
    expect(events[0]).toMatchObject({
      type: 'payment_made',
      metadata: { amount: 10.5, status: 'PAID' },
    })
    expect(events.map((row) => row.id)).toEqual([
      expect.stringContaining('payment-'),
      `rental-updated-${rentalIds[0]}-${new Date('2032-02-05').getTime()}`,
      `rental-created-${rentalIds[0]}`,
      `quote-approved-${quoteIds[0]}`,
    ])
  })
  it('preserves administrative filters, pagination and tenant-scoped detail', async () => {
    const path = `/api/admin/rentals?userId=${context.identity.users[0]!.id}&startDate=2031-03-01&endDate=2031-03-04&page=1&limit=1`
    for (const host of hosts) {
      const list = await request(host, 'GET', path)
      expect(list.body.pagination).toEqual({
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      })
      expect(list.body.rentals[0].id).toBe(rentalIds[0])
      expect(list).toEqual(expectedCycle.adminList())
      const detail = await request(
        host,
        'GET',
        `/api/admin/rentals/${rentalIds[0]}`
      )
      expect(detail.body.rental.rental_items[0].priceperday).toBe('10.5')
      expect(detail).toEqual(expectedCycle.adminDetail())
    }
    for (const host of hosts)
      expect(
        await request(host, 'GET', `/api/admin/rentals/${rentalIds[2]}`)
      ).toMatchObject({ status: 404, body: { error: 'Rental not found' } })
  })
  it('creates a manual rental with the existing rounding, status, customer and item dates', async () => {
    for (const host of hosts) {
      const result = await request(host, 'POST', '/api/admin/rentals', {
        userId: context.identity.users[0]!.id,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        notes: marker,
        items: [
          {
            equipmentId: context.alfa.equipmentIds[0],
            quantity: 1,
            days: 1,
            pricePerDay: '10.005',
          },
        ],
        extra: 'discard',
      })
      expect(result.status).toBe(201)
      const id = result.body.rental.id as string
      manualIds.add(id)
      expect(result.body.rental).toMatchObject({
        tenantId: context.alfa.id,
        status: 'PENDING',
        total: '10.01',
        notes: marker,
      })
      const row = await prisma.rental_items.findFirstOrThrow({
        where: { rentalid: id },
      })
      expect(row.totalprice.toString()).toBe('10.01')
      expect(row.startDate).toEqual(start)
      await prisma.rentals.delete({ where: { id } })
      manualIds.delete(id)
    }
  })
  it('reuses quote conversion rather than creating an independent second rental', async () => {
    for (const host of hosts) {
      const result = await request(host, 'POST', '/api/admin/rentals', {
        userId: context.identity.users[0]!.id,
        quoteId: quoteIds[0],
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        items: [],
      })
      expect(result.status).toBe(201)
      expect(result.body.rental.id).toBe(rentalIds[0])
      expect(
        await prisma.rentals.count({ where: { quoteId: quoteIds[0] } })
      ).toBe(1)
    }
  })
  it('keeps checkout blocked by required documents, including documents from another tenant', async () => {
    await prisma.rentals.update({
      where: { id: rentalIds[0]! },
      data: { status: 'PENDING' },
    })
    await documents(context.bravo.id)
    const before = await snapshot()
    for (const host of hosts) {
      const response = await request(
        host,
        'POST',
        `/api/admin/rentals/${rentalIds[0]}/checkout`,
        '{'
      )
      expect(response.status).toBe(400)
      expect(response.body.missingDocuments).toEqual([
        'ID_DOCUMENT',
        'SELFIE',
        'SIGNED_CONTRACT',
        'CPF_CNPJ_PROOF',
      ])
    }
    expect(await snapshot()).toEqual(before)
  })
  it('serializes checkout across both hosts and makes its retry idempotent', async () => {
    await prisma.rentals.update({
      where: { id: rentalIds[0]! },
      data: { status: 'PENDING' },
    })
    await documents()
    // Dois checkouts reais e simultâneos: raiz e API, ou a API duas vezes sem a raiz (onda 135, B2).
    const result = await Promise.all(
      [0, 1]
        .map((index) => rotatingTarget(context, index))
        .map((host) =>
          request(
            host,
            'POST',
            `/api/admin/rentals/${rentalIds[0]}/checkout`,
            '{'
          )
        )
    )
    expect(result[0]!.status).toBe(200)
    // parity-scan: o checkout é idempotente; a segunda chamada real devolve a mesma resposta.
    expect(result[1]).toEqual(result[0])
    expect(result[0]!.body.rental.status).toBe('ACTIVE')
    expect(
      (await prisma.rentals.findUniqueOrThrow({ where: { id: rentalIds[0]! } }))
        .checkOutAt
    ).not.toBeNull()
  })
  it('blocks checkout while the upfront obligation is unpaid', async () => {
    await prisma.rentals.update({
      where: { id: rentalIds[0]! },
      data: { status: 'PENDING' },
    })
    await prisma.quote.update({
      where: { id: quoteIds[0]! },
      data: { paymentTerms: 'UPFRONT' },
    })
    await documents()
    const before = await snapshot()
    for (const host of hosts)
      expect(
        (
          await request(
            host,
            'POST',
            `/api/admin/rentals/${rentalIds[0]}/checkout`
          )
        ).status
      ).toBe(400)
    expect(await snapshot()).toEqual(before)
  })
  it('patches cents and notes, then cancels without deleting the operational record', async () => {
    for (const host of hosts) {
      await restore()
      expect(
        (
          await request(host, 'PATCH', `/api/admin/rentals/${rentalIds[0]}`, {
            lateFee: '1.005',
            notes: '',
            extra: true,
          })
        ).body.rental
      ).toMatchObject({ lateFee: '1.01', notes: '' })
      expect(
        await request(host, 'DELETE', `/api/admin/rentals/${rentalIds[0]}`, '{')
      ).toMatchObject({
        status: 200,
        body: { message: 'Rental cancelled successfully' },
      })
      expect(
        (
          await prisma.rentals.findUniqueOrThrow({
            where: { id: rentalIds[0]! },
          })
        ).status
      ).toBe('CANCELLED')
      expect(
        await prisma.rental_items.count({ where: { rentalid: rentalIds[0]! } })
      ).toBe(1)
      expect(
        (
          await request(host, 'PATCH', `/api/admin/rentals/${rentalIds[0]}`, {
            status: 'ACTIVE',
          })
        ).status
      ).toBe(409)
    }
  })
  it('preserves admin extension cents and queues boleto without calling the provider', async () => {
    for (const host of hosts) {
      await restore()
      const response = await request(
        host,
        'POST',
        `/api/admin/rentals/${rentalIds[0]}/extend`,
        { additionalDays: 2, boletoDueDate: '2031-03-09' }
      )
      expect(response.status).toBe(202)
      expect(response.body).toMatchObject({
        extensionFee: 42,
        boletoPending: true,
      })
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: response.body.paymentId },
      })
      expect(payment).toMatchObject({
        tenantId: context.alfa.id,
        method: 'BOLETO',
        status: 'PENDING',
        billingStatus: 'AWAITING_PAYMENT',
      })
      expect(payment.amount.toString()).toBe('42')
      expect(payment.dueDate).toEqual(new Date('2031-03-09'))
      expect(
        await prisma.outboxEvent.count({
          where: {
            tenantId: context.alfa.id,
            topic: 'payment.boleto.issue',
            aggregateId: payment.id,
          },
        })
      ).toBe(1)
      expect(
        (
          await prisma.rentals.findUniqueOrThrow({
            where: { id: rentalIds[0]! },
          })
        ).enddate
      ).toEqual(new Date('2031-03-06'))
    }
  })
  it('preserves extension without boleto and the distinct client PIX extension', async () => {
    for (const host of hosts) {
      await restore()
      expect(
        await request(
          host,
          'POST',
          `/api/admin/rentals/${rentalIds[0]}/extend`,
          { additionalDays: 1, generateBoleto: false }
        )
      ).toMatchObject({
        status: 200,
        body: { extensionFee: 21, boletoPending: false },
      })
      expect(
        await prisma.payment.count({ where: { rentalId: rentalIds[0] } })
      ).toBe(0)
      await restore()
      const response = await request(
        host,
        'POST',
        `/api/client/rentals/${rentalIds[0]}/extend`,
        { extensionDays: 2 },
        clientJar
      )
      expect(response).toMatchObject({
        status: 200,
        body: {
          extensionFee: 6.7,
          message: 'Prorrogação solicitada com sucesso',
        },
      })
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: response.body.paymentId },
      })
      expect(payment.method).toBe('PIX')
      expect(payment.amount.toString()).toBe('6.7')
      expect(
        await prisma.outboxEvent.count({ where: { aggregateId: payment.id } })
      ).toBe(0)
    }
  })
  it('completes check-in and records rounded damage charge without deleting items', async () => {
    for (const host of hosts) {
      await restore()
      const response = await request(
        host,
        'POST',
        `/api/admin/rentals/${rentalIds[0]}/checkin`,
        { damageFee: 1.005, notes: 'returned' }
      )
      expect(response).toMatchObject({
        status: 200,
        body: {
          lateFee: null,
          damageFee: 1.005,
          rental: { status: 'COMPLETED', notes: 'returned' },
        },
      })
      const payment = await prisma.payment.findFirstOrThrow({
        where: { rentalId: rentalIds[0], type: 'DAMAGE' },
      })
      expect(payment.amount.toString()).toBe('1.01')
      expect(payment.method).toBe('BOLETO')
      expect(
        await prisma.rental_items.count({ where: { rentalid: rentalIds[0] } })
      ).toBe(1)
      expect(
        (
          await request(
            host,
            'POST',
            `/api/admin/rentals/${rentalIds[0]}/checkin`,
            {}
          )
        ).status
      ).toBe(409)
    }
  })
  it('applies late fee once across both hosts, preserving non-overdue behavior', async () => {
    for (const host of hosts)
      expect(
        await request(
          host,
          'POST',
          `/api/admin/rentals/${rentalIds[0]}/calculate-late-fee`,
          '{'
        )
      ).toMatchObject({
        status: 200,
        body: { lateFee: 0, daysOverdue: 0, message: 'Rental is not overdue' },
      })
    await prisma.rentals.update({
      where: { id: rentalIds[0]! },
      data: {
        startdate: new Date('2026-01-01'),
        enddate: new Date('2026-01-04'),
      },
    })
    // Duas cobranças reais e simultâneas: raiz e API, ou a API duas vezes sem a raiz (onda 135, B2).
    const results = await Promise.all(
      [0, 1]
        .map((index) => rotatingTarget(context, index))
        .map((host) =>
          request(
            host,
            'POST',
            `/api/admin/rentals/${rentalIds[0]}/calculate-late-fee`,
            '{'
          )
        )
    )
    // parity-scan: a multa é lançada uma vez; a segunda chamada real devolve o mesmo resultado.
    expect(results[1]).toEqual(results[0])
    expect(results[0]!.status).toBe(200)
    expect(results[0]!.body.lateFee).toBeGreaterThan(0)
    expect(
      await prisma.payment.count({
        where: { rentalId: rentalIds[0], type: 'LATE_FEE' },
      })
    ).toBe(1)
  })
  it.each(['payments', 'outbox_events'])(
    'rolls back extension dates, charge and outbox when %s write fails',
    async (table) => {
      const fault = `api_cycle_fault_${randomUUID().replaceAll('-', '')}`
      try {
        await pool.query(
          `CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture-private-failure' USING ERRCODE='42501'; RETURN NULL; END $$`
        )
        await pool.query(
          `CREATE TRIGGER ${fault} AFTER INSERT ON ${table} FOR EACH ROW WHEN (NEW."tenantId" = '${context.alfa.id}') EXECUTE FUNCTION ${fault}()`
        )
        const before = await snapshot()
        for (const host of hosts)
          expect(
            await request(
              host,
              'POST',
              `/api/admin/rentals/${rentalIds[0]}/extend`,
              { additionalDays: 2 }
            )
          ).toMatchObject({
            status: 500,
            body: { error: 'Internal server error' },
          })
        expect(await snapshot()).toEqual(before)
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS ${fault} ON ${table}`)
        await pool.query(`DROP FUNCTION IF EXISTS ${fault}()`)
      }
    }
  )
  it.each(['extend', 'checkin', 'checkout', 'calculate-late-fee'])(
    'rejects cross-tenant rental %s without write',
    async (suffix) => {
      const before = await snapshot()
      for (const host of hosts)
        expect(
          (
            await request(
              host,
              'POST',
              `/api/admin/rentals/${rentalIds[2]}/${suffix}`,
              { additionalDays: 2 }
            )
          ).status
        ).toBe(404)
      expect(await snapshot()).toEqual(before)
    }
  )
  it('rejects client extension for a different owner, including in the same tenant', async () => {
    const before = await snapshot()
    for (const host of hosts)
      for (const id of rentalIds.slice(1))
        expect(
          (
            await request(
              host,
              'POST',
              `/api/client/rentals/${id}/extend`,
              { extensionDays: 2 },
              clientJar
            )
          ).status
        ).toBe(404)
    expect(await snapshot()).toEqual(before)
  })
  it.each([
    ['admin/rentals', { items: [] }],
    [`admin/rentals/${rentalIds[0]}/checkin`, { damageFee: -1 }],
    [`admin/rentals/${rentalIds[0]}/extend`, { additionalDays: 0 }],
    [`client/rentals/${rentalIds[0]}/extend`, { extensionDays: 31 }],
  ])('preserves schema validation for %s', async (path, body) => {
    const before = await snapshot()
    for (const host of hosts)
      expect(
        (
          await request(
            host,
            'POST',
            '/api/' + path,
            body,
            path.startsWith('client') ? clientJar : adminJar
          )
        ).status
      ).toBe(400)
    expect(await snapshot()).toEqual(before)
  })
  it('revalidates both revoked memberships and leaves the lifecycle unchanged', async () => {
    await prisma.membership.updateMany({
      where: {
        id: { in: [context.identity.memberships[0]!, adminMembership] },
      },
      data: { status: 'REVOKED' },
    })
    const before = await snapshot()
    for (const host of hosts)
      for (const [method, path] of endpoints)
        expect(
          (
            await request(
              host,
              method,
              path,
              '{',
              path.startsWith('/api/admin') ? adminJar : clientJar
            )
          ).status
        ).toBe(403)
    expect(await snapshot()).toEqual(before)
  })
})
