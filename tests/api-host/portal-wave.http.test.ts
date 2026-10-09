import {
  afterAll,
  afterEach,
  beforeAll,
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
import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createClientRentalApi } from '../../packages/frontend/src/entities/locacao/api/client-rentals'
import { createClientQuoteApi } from '../../packages/frontend/src/entities/orcamento/api/client-quotes'
import { parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const hosts = parityTargets(context)
const rentals = Array.from({ length: 4 }, () => randomUUID())
const quotes = Array.from({ length: 4 }, () => randomUUID())
const quoteItemIds = Array.from({ length: 4 }, () => randomUUID())
const rentalItemIds = Array.from({ length: 4 }, () => randomUUID())
const paymentId = randomUUID()
const adminMembership = randomUUID()
const endDate = new Date('2026-12-01T00:00:00Z')
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[50]!,
}
let jar: string
const endpoints = [
  ['GET', '/api/client/rentals'],
  ['GET', `/api/client/rentals/${rentals[0]}`],
  ['DELETE', `/api/client/rentals/${rentals[0]}`],
  ['POST', `/api/client/rentals/${rentals[0]}/request-pickup`],
  ['POST', `/api/client/rentals/${rentals[0]}/request-extension`],
  ['GET', `/api/quotes/${quotes[0]}`],
  ['DELETE', `/api/quotes/${quotes[0]}`],
  ['GET', '/api/admin/quotes'],
  ['GET', `/api/admin/quotes/${quotes[0]}`],
] as const
async function request(
  host: string,
  method: string,
  path: string,
  body?: unknown,
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
    cookie: response.headers.get('set-cookie'),
  }
}
async function records() {
  return {
    audits: await prisma.auditLog.findMany({
      where: { entityId: { in: rentals } },
    }),
    notifications: await prisma.notification.findMany({
      where: {
        tenantId: context.alfa.id,
        metadata: { path: ['rentalId'], equals: rentals[0] },
      },
    }),
  }
}
async function clearRequests() {
  await prisma.notification.deleteMany({
    where: {
      tenantId: context.alfa.id,
      metadata: { path: ['rentalId'], equals: rentals[0] },
    },
  })
  await prisma.auditLog.deleteMany({ where: { entityId: { in: rentals } } })
}
async function restore() {
  await clearRequests()
  await prisma.rentals.update({
    where: { id: rentals[0]! },
    data: { clientDeletedAt: null, status: 'ACTIVE', enddate: endDate },
  })
  await prisma.quote.update({
    where: { id: quotes[0]! },
    data: { clientDeletedAt: null, status: 'APPROVED' },
  })
  await prisma.membership.update({
    where: { id: context.identity.memberships[0]! },
    data: { role: 'CLIENT', status: 'ACTIVE' },
  })
  await prisma.membership.update({
    where: { id: adminMembership },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
}
beforeAll(async () => {
  jar = await signInParityUser(context, edge, 0)
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
    const tenant = index === 2 ? context.bravo : context.alfa
    const userId = context.identity.users[index === 1 ? 1 : 0]!.id
    const clientDeletedAt = index === 3 ? new Date('2026-01-01') : null
    await prisma.quote.create({
      data: {
        id: quotes[index]!,
        tenantId: tenant.id,
        userId,
        name: `Portal ${index}`,
        email: 'portal@example.test',
        phone: 'fixture-phone',
        total: '100.50',
        status: 'APPROVED',
        createdAt: new Date(Date.UTC(2032, 0, index + 1)),
        clientDeletedAt,
        items: {
          create: {
            id: quoteItemIds[index],
            tenantId: tenant.id,
            equipmentId: tenant.equipmentIds[0]!,
            pricePerDay: '10.50',
            total: '63',
            quantity: 2,
            days: 3,
          },
        },
      },
    })
    await prisma.rentals.create({
      data: {
        id: rentals[index]!,
        tenantId: tenant.id,
        userid: userId,
        quoteId: quotes[index]!,
        total: '100.50',
        status: 'ACTIVE',
        startdate: new Date('2026-11-01'),
        enddate: endDate,
        clientDeletedAt,
        rental_items: {
          create: {
            id: rentalItemIds[index]!,
            tenantId: tenant.id,
            equipmentid: tenant.equipmentIds[0]!,
            priceperday: '10.50',
            totalprice: '63',
            quantity: 2,
            totaldays: 3,
          },
        },
      },
    })
  }
  await prisma.payment.create({
    data: {
      id: paymentId,
      tenantId: context.alfa.id,
      quoteId: quotes[0],
      amount: '10.50',
      method: 'BOLETO',
      status: 'PENDING',
      dueDate: endDate,
      metadata: { pdfUrl: 'https://example.test/private-fixture.pdf' },
    },
  })
})
afterEach(restore)
afterAll(async () => {
  await clearRequests()
  await prisma.payment.deleteMany({ where: { quoteId: { in: quotes } } })
  await prisma.rentals.deleteMany({ where: { id: { in: rentals } } })
  await prisma.quote.deleteMany({ where: { id: { in: quotes } } })
  await prisma.membership.deleteMany({ where: { id: adminMembership } })
  await prisma.$disconnect()
  await pool.end()
})

/** Respostas completas esperadas do portal, montadas da fixture deste arquivo (onda 135, B2). */
function expectedEquipment() {
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
function expectedRawQuote() {
  return {
    id: quotes[0],
    tenantId: context.alfa.id,
    userId: context.identity.users[0]!.id,
    quoteCode: null,
    legacyExternalCode: null,
    name: 'Portal 0',
    email: 'portal@example.test',
    phone: 'fixture-phone',
    company: null,
    message: null,
    total: '100.5',
    status: 'APPROVED',
    clientDeletedAt: null,
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
    cep: null,
    cnpj: null,
    cpf: null,
    adminNotes: null,
    approvedAt: null,
    approvedBy: null,
    convertedToRentalId: null,
    paymentTerms: 'UPFRONT',
    deliveryAddress: null,
    deliveryFee: null,
    deliveryType: null,
    deposit: null,
    discount: null,
    endDate: null,
    finalTotal: null,
    internalNotes: null,
    pickupFee: null,
    priority: 0,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    startDate: null,
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
        quoteId: quotes[0],
        equipmentId: context.alfa.equipmentIds[0],
        pricePerDay: '10.5',
        total: '63',
        quantity: 2,
        days: 3,
        startDate: null,
        endDate: null,
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
function expectedPayment() {
  return {
    id: paymentId,
    amount: 10.5,
    status: 'PENDING',
    method: 'BOLETO',
    dueDate: endDate.toISOString(),
    paidAt: null,
    metadata: { pdfUrl: 'https://example.test/private-fixture.pdf' },
  }
}
function expectedAdminQuote(index: number) {
  return {
    id: quotes[index],
    quoteCode: null,
    legacyExternalCode: null,
    paymentTerms: 'UPFRONT',
    name: 'Portal ' + index,
    email: 'portal@example.test',
    phone: 'fixture-phone',
    company: null,
    customerImage: null,
    cpf: null,
    cnpj: null,
    cep: null,
    equipments: [
      {
        id: context.alfa.equipmentIds[0],
        name: 'Betoneira alfa 00',
        quantity: 2,
        dailyPrice: 10.5,
      },
    ],
    startDate: null,
    endDate: null,
    totalPrice: 100.5,
    originalTotal: 100.5,
    finalTotal: null,
    priceAdjustmentReason: null,
    priceAdjustedAt: null,
    priceAdjustedBy: null,
    lateFee: null,
    lateFeeApproved: false,
    lateFeeApprovedAt: null,
    lateFeeApprovedBy: null,
    validUntil: null,
    rejectedAt: null,
    rejectionReason: null,
    rejectedBy: null,
    approvedAt: null,
    payments: index === 0 ? [expectedPayment()] : [],
    status: 'approved',
    message: null,
    deliveryType: null,
    deliveryAddress: null,
    deliveryFee: null,
    pickupFee: null,
    operationType: null,
    serviceAmount: null,
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
    items: [
      {
        id: quoteItemIds[index],
        quantity: 2,
        days: 3,
        startDate: null,
        endDate: null,
        includeWeekends: false,
        appliedDiscount: null,
        appliedPeriod: null,
        useDirectValue: false,
        directValue: null,
        pricePerDay: 10.5,
        total: 63,
        equipment: {
          id: context.alfa.equipmentIds[0],
          name: 'Betoneira alfa 00',
          images: ['https://assets.example.test/alfa.jpg'],
        },
      },
    ],
  }
}
const expectedPortal = {
  rentalDetail(): unknown {
    return {
      status: 200,
      cache: null,
      cookie: null,
      body: {
        rental: {
          id: rentals[0],
          tenantId: context.alfa.id,
          userid: context.identity.users[0]!.id,
          quoteId: quotes[0],
          total: '100.5',
          status: 'ACTIVE',
          startdate: '2026-11-01T00:00:00.000Z',
          enddate: endDate.toISOString(),
          createdat: expect.any(String),
          updatedat: expect.any(String),
          clientDeletedAt: null,
          checkInAt: null,
          checkOutAt: null,
          extensionDays: null,
          extensionFee: null,
          lateFee: null,
          notes: null,
          rental_items: [
            {
              id: rentalItemIds[0],
              tenantId: context.alfa.id,
              rentalid: rentals[0],
              equipmentid: context.alfa.equipmentIds[0],
              quantity: 2,
              totaldays: 3,
              priceperday: '10.5',
              totalprice: '63',
              startDate: null,
              endDate: null,
              includeWeekends: false,
              createdat: expect.any(String),
              updatedat: expect.any(String),
              equipments: expectedEquipment(),
            },
          ],
          payments: [],
          deliveries: [],
          quote: expectedRawQuote(),
          contract: null,
        },
      },
    }
  },
  quoteDetail(): unknown {
    return {
      status: 200,
      cache: null,
      cookie: null,
      body: {
        id: quotes[0],
        quoteCode: null,
        legacyExternalCode: null,
        name: 'Portal 0',
        email: 'portal@example.test',
        phone: 'fixture-phone',
        company: null,
        totalPrice: 100.5,
        originalTotal: 100.5,
        finalTotal: null,
        priceAdjustmentReason: null,
        priceAdjustedAt: null,
        lateFee: null,
        lateFeeApproved: false,
        status: 'approved',
        deliveryType: null,
        deliveryFee: null,
        pickupFee: null,
        deliveryAddress: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        approvedAt: null,
        rejectedAt: null,
        validUntil: null,
        items: [
          {
            id: quoteItemIds[0],
            quantity: 2,
            days: 3,
            startDate: null,
            endDate: null,
            pricePerDay: 10.5,
            total: 63,
            appliedDiscount: null,
            appliedPeriod: null,
            useDirectValue: false,
            directValue: null,
            includeWeekends: false,
            equipment: {
              id: context.alfa.equipmentIds[0],
              name: 'Betoneira alfa 00',
              images: ['https://assets.example.test/alfa.jpg'],
              category: { name: 'Andaimes' },
            },
          },
        ],
        payments: [expectedPayment()],
        adjustments: [],
      },
    }
  },
  adminQuotes(): unknown {
    return {
      status: 200,
      cache: 'no-store',
      cookie: null,
      body: {
        quotes: [3, 1, 0].map(expectedAdminQuote),
        pagination: { page: 1, limit: 100, totalItems: 3, totalPages: 1 },
        // A fixture global tem quatro APPROVED e dois REJECTED; a local acrescenta três APPROVED.
        stats: { total: 9, pending: 0, approved: 7, rejected: 2, expired: 0 },
      },
    }
  },
}
describe('portal wave: real sessions, tenant ownership and durable requests', () => {
  it.each(hosts)(
    'configured detail and action consumers preserve ownership and request semantics: %s',
    async (host) => {
      const client = createHttpClient({
        baseUrl: host,
        getHeaders: () => ({
          ...edge,
          Cookie: jar,
          'x-tenant-id': context.alfa.id,
          Origin: edge['x-platform-origin'],
        }),
      })
      const rentalApi = createClientRentalApi(client)
      const quoteApi = createClientQuoteApi(client)
      const detail = await rentalApi.read(rentals[0]!)
      expect(detail.rental.id).toBe(rentals[0])
      expect(Number(detail.rental.total)).toBe(100.5)
      expect(detail.rental.rental_items[0]?.quantity).toBe(2)
      expect((await quoteApi.read(quotes[0]!)).id).toBe(quotes[0])
      for (const index of [1, 2, 3]) {
        await expect(rentalApi.read(rentals[index]!)).rejects.toMatchObject({
          status: 404,
        })
        await expect(quoteApi.read(quotes[index]!)).rejects.toMatchObject({
          status: 404,
        })
      }
      expect((await rentalApi.requestExtension(rentals[0]!, 365)).success).toBe(
        true
      )
      expect((await rentalApi.requestPickup(rentals[0]!)).success).toBe(true)
      expect(
        (await prisma.rentals.findUniqueOrThrow({ where: { id: rentals[0]! } }))
          .enddate
      ).toEqual(endDate)
      expect((await records()).audits).toHaveLength(2)
      expect((await records()).notifications.length).toBeGreaterThan(0)
      await expect(rentalApi.extend(rentals[0]!, 31)).rejects.toMatchObject({
        status: 400,
      })
    }
  )
  it.each(endpoints)(
    '%s %s denies absent session before malformed input',
    async (method, path) => {
      const before = await records()
      for (const host of hosts)
        expect(
          (await request(host, method, path, '{', { Cookie: '' })).status
        ).toBe(401)
      expect(await records()).toEqual(before)
    }
  )
  it.each(endpoints.filter(([method]) => method !== 'GET'))(
    '%s %s rejects sibling-origin mutations without effects',
    async (method, path) => {
      for (const host of hosts)
        expect(
          await request(host, method, path, '{', {
            Origin: 'https://bravo.platform.test',
            'Sec-Fetch-Site': 'same-site',
          })
        ).toMatchObject({ status: 403, cache: 'no-store' })
      expect(await records()).toEqual({ audits: [], notifications: [] })
      expect(
        (await prisma.rentals.findUniqueOrThrow({ where: { id: rentals[0]! } }))
          .clientDeletedAt
      ).toBeNull()
      expect(
        (await prisma.quote.findUniqueOrThrow({ where: { id: quotes[0]! } }))
          .clientDeletedAt
      ).toBeNull()
    }
  )
  it('lists only the caller rentals and preserves detail DTO, filters and hidden history', async () => {
    for (const host of hosts) {
      const list = await request(
        host,
        'GET',
        '/api/client/rentals?status=ACTIVE'
      )
      expect(list.status).toBe(200)
      expect(list.body.rentals.map((row: { id: string }) => row.id)).toContain(
        rentals[0]
      )
      for (const id of rentals.slice(1))
        expect(
          list.body.rentals.map((row: { id: string }) => row.id)
        ).not.toContain(id)
      const detail = await request(
        host,
        'GET',
        `/api/client/rentals/${rentals[0]}`
      )
      expect(detail).toMatchObject({
        status: 200,
        cookie: null,
        body: {
          rental: {
            id: rentals[0],
            tenantId: context.alfa.id,
            userid: context.identity.users[0]!.id,
            status: 'ACTIVE',
            total: '100.5',
            contract: null,
          },
        },
      })
      expect(detail.body.rental.rental_items).toHaveLength(1)
      expect(detail.body.rental.quote.items).toHaveLength(1)
      expect(detail).toEqual(expectedPortal.rentalDetail())
      expect(
        (await request(host, 'GET', '/api/client/rentals?status=INVALID'))
          .status
      ).toBe(200)
    }
  })
  it.each([1, 2, 3])(
    'does not expose other-user, other-tenant or hidden detail #%i',
    async (index) => {
      for (const host of hosts) {
        expect(
          await request(host, 'GET', `/api/client/rentals/${rentals[index]}`)
        ).toMatchObject({ status: 404, body: { error: 'Rental not found' } })
        expect(
          await request(host, 'GET', `/api/quotes/${quotes[index]}`)
        ).toMatchObject({
          status: 404,
          body: { error: 'Orçamento não encontrado' },
        })
      }
    }
  )
  it('preserves numeric quote DTO and redacts payment metadata of rejected quotes', async () => {
    for (const host of hosts) {
      const detail = await request(host, 'GET', `/api/quotes/${quotes[0]}`)
      expect(detail).toMatchObject({
        status: 200,
        body: { id: quotes[0], status: 'approved', totalPrice: 100.5 },
      })
      expect(detail.body.items[0]).toMatchObject({
        quantity: 2,
        days: 3,
        pricePerDay: 10.5,
        total: 63,
      })
      expect(detail.body.payments[0].metadata.pdfUrl).toBe(
        'https://example.test/private-fixture.pdf'
      )
      expect(detail).toEqual(expectedPortal.quoteDetail())
    }
    await prisma.quote.update({
      where: { id: quotes[0]! },
      data: { status: 'REJECTED' },
    })
    for (const host of hosts)
      expect(
        (await request(host, 'GET', `/api/quotes/${quotes[0]}`)).body
          .payments[0].metadata
      ).toBeNull()
  })
  it('soft deletes owned history while keeping operational rows, items and charges', async () => {
    for (const host of hosts) {
      expect(
        await request(host, 'DELETE', `/api/client/rentals/${rentals[0]}`, '{')
      ).toMatchObject({
        status: 200,
        body: { message: 'Locação removida do histórico com sucesso' },
      })
      expect(
        (await request(host, 'GET', `/api/client/rentals/${rentals[0]}`)).status
      ).toBe(404)
      expect(
        (await prisma.rentals.findUniqueOrThrow({ where: { id: rentals[0]! } }))
          .status
      ).toBe('ACTIVE')
      expect(
        await prisma.rental_items.count({ where: { rentalid: rentals[0] } })
      ).toBe(1)
      expect(
        await request(host, 'DELETE', `/api/quotes/${quotes[0]}`, '{')
      ).toMatchObject({
        status: 200,
        body: { message: 'Orçamento removido do histórico com sucesso' },
      })
      expect(
        (await request(host, 'GET', `/api/quotes/${quotes[0]}`)).status
      ).toBe(404)
      expect(
        await prisma.payment.count({ where: { quoteId: quotes[0] } })
      ).toBe(1)
      await prisma.membership.update({
        where: { id: context.identity.memberships[0]! },
        data: { role: 'ADMIN' },
      })
      expect(
        (await request(host, 'GET', `/api/admin/quotes/${quotes[0]}`)).status
      ).toBe(200)
      await restore()
    }
  })
  it.each([1, 2])(
    'refuses foreign-user or foreign-tenant mutation #%i',
    async (index) => {
      for (const host of hosts) {
        for (const path of [
          `/api/client/rentals/${rentals[index]}`,
          `/api/quotes/${quotes[index]}`,
        ])
          expect((await request(host, 'DELETE', path)).status).toBe(404)
        for (const kind of ['request-pickup', 'request-extension'])
          expect(
            (
              await request(
                host,
                'POST',
                `/api/client/rentals/${rentals[index]}/${kind}`,
                { additionalDays: 3 }
              )
            ).status
          ).toBe(404)
      }
      expect(await records()).toEqual({ audits: [], notifications: [] })
    }
  )
  it.each(['request-pickup', 'request-extension'])(
    'durably deduplicates %s and notifies only local active admins',
    async (kind) => {
      for (const host of hosts) {
        const before = await prisma.rentals.findUniqueOrThrow({
          where: { id: rentals[0]! },
        })
        const first = await request(
          host,
          'POST',
          `/api/client/rentals/${rentals[0]}/${kind}`,
          kind === 'request-pickup' ? '{' : { additionalDays: 3 }
        )
        expect(first).toMatchObject({
          status: 200,
          body: {
            success: true,
            duplicate: false,
            message: 'Solicitação enviada à locadora',
            note: 'Aguarde a confirmação da equipe.',
          },
        })
        if (kind === 'request-extension')
          expect(first.body).toMatchObject({
            additionalDays: 3,
            estimatedFee: 63,
          })
        const again = await request(
          host,
          'POST',
          `/api/client/rentals/${rentals[0]}/${kind}`,
          { additionalDays: 3 }
        )
        expect(again.body).toMatchObject({
          duplicate: true,
          requestId: first.body.requestId,
        })
        const saved = await records()
        expect(saved.audits).toHaveLength(1)
        expect(saved.notifications).toHaveLength(1)
        expect(saved.notifications[0]).toMatchObject({
          tenantId: context.alfa.id,
          userId: context.identity.users[1]!.id,
          type: 'RENTAL',
          priority: 'HIGH',
        })
        expect(
          await prisma.rentals.findUniqueOrThrow({ where: { id: rentals[0]! } })
        ).toEqual(before)
        // Corpo completo esperado, sem o ID gerado (onda 135, B2).
        const { requestId, ...body } = first.body
        expect(requestId).toEqual(expect.any(String))
        expect(body).toEqual({
          success: true,
          duplicate: false,
          message: 'Solicitação enviada à locadora',
          note: 'Aguarde a confirmação da equipe.',
          ...(kind === 'request-extension'
            ? { additionalDays: 3, estimatedFee: 63 }
            : {}),
        })
        await clearRequests()
      }
    }
  )
  it.each([
    { additionalDays: 0 },
    { additionalDays: 366 },
    { additionalDays: 1.5 },
    { additionalDays: '3' },
    { additionalDays: 3, tenantId: 'foreign' },
    {},
  ])('preserves strict extension validation for %j', async (input) => {
    for (const host of hosts)
      expect(
        await request(
          host,
          'POST',
          `/api/client/rentals/${rentals[0]}/request-extension`,
          input
        )
      ).toMatchObject({ status: 400, body: { error: 'Prazo inválido' } })
    expect(await records()).toEqual({ audits: [], notifications: [] })
  })
  it('does not confirm a request if local service has no active admin', async () => {
    await prisma.membership.update({
      where: { id: adminMembership },
      data: { status: 'REVOKED' },
    })
    for (const host of hosts)
      expect(
        await request(
          host,
          'POST',
          `/api/client/rentals/${rentals[0]}/request-pickup`
        )
      ).toMatchObject({
        status: 503,
        body: { error: 'Atendimento da locadora indisponível' },
      })
    expect(await records()).toEqual({ audits: [], notifications: [] })
  })
  it('coexisting legacy and service writers deduplicate concurrent requests', async () => {
    // Duas requisições reais e simultâneas: raiz e API, ou a API duas vezes sem a raiz (onda 135, B2).
    const responses = await Promise.all(
      [0, 1].map((index) =>
        request(
          rotatingTarget(context, index),
          'POST',
          `/api/client/rentals/${rentals[0]}/request-extension`,
          { additionalDays: 3 }
        )
      )
    )
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(responses.map((response) => response.body.duplicate).sort()).toEqual(
      [false, true]
    )
    // parity-scan: as duas chamadas reais disputam o mesmo pedido; a perdedora devolve o ID da vencedora.
    expect(responses[0]!.body.requestId).toBe(responses[1]!.body.requestId)
    const saved = await records()
    expect(saved.audits).toHaveLength(1)
    expect(saved.notifications).toHaveLength(1)
  })
  it('rolls back the audit if inserting the administrative notification fails', async () => {
    const name = `api_portal_fault_${randomUUID().replaceAll('-', '')}`
    await pool.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.metadata->>'rentalId' = '${rentals[0]}' THEN RAISE EXCEPTION 'private portal failure'; END IF; RETURN NULL; END $$`
    )
    try {
      await pool.query(
        `CREATE TRIGGER ${name} AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION ${name}()`
      )
      for (const host of hosts) {
        expect(
          await request(
            host,
            'POST',
            `/api/client/rentals/${rentals[0]}/request-pickup`
          )
        ).toMatchObject({
          status: 500,
          body: { error: 'Não foi possível registrar a solicitação' },
        })
        expect(await records()).toEqual({ audits: [], notifications: [] })
      }
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${name} ON notifications`)
      await pool.query(`DROP FUNCTION ${name}()`)
    }
  })
  it('keeps malformed extension JSON generic and revalidates membership', async () => {
    for (const host of hosts)
      expect(
        await request(
          host,
          'POST',
          `/api/client/rentals/${rentals[0]}/request-extension`,
          '{'
        )
      ).toMatchObject({
        status: 500,
        body: { error: 'Não foi possível registrar a solicitação' },
      })
    await prisma.membership.update({
      where: { id: context.identity.memberships[0]! },
      data: { status: 'REVOKED' },
    })
    for (const host of hosts)
      for (const [method, path] of endpoints)
        expect(
          (await request(host, method, path, { additionalDays: 3 })).status
        ).toBe(403)
    expect(await records()).toEqual({ audits: [], notifications: [] })
  })
  it('requests require ACTIVE rentals and ignore hidden ones', async () => {
    await prisma.rentals.update({
      where: { id: rentals[0]! },
      data: { status: 'COMPLETED' },
    })
    for (const host of hosts) {
      expect(
        (
          await request(
            host,
            'POST',
            `/api/client/rentals/${rentals[0]}/request-pickup`
          )
        ).status
      ).toBe(400)
      expect(
        (
          await request(
            host,
            'POST',
            `/api/client/rentals/${rentals[3]}/request-pickup`
          )
        ).status
      ).toBe(404)
    }
    expect(await records()).toEqual({ audits: [], notifications: [] })
  })
  it('admin quote listing keeps permission, paging, filters, DTO and no-store', async () => {
    await prisma.membership.update({
      where: { id: context.identity.memberships[0]! },
      data: { role: 'ADMIN' },
    })
    for (const host of hosts) {
      const response = await request(
        host,
        'GET',
        '/api/admin/quotes?search=%20Portal%20&status=approved&page=1&limit=100'
      )
      expect(response).toMatchObject({ status: 200, cache: 'no-store' })
      const ids = response.body.quotes.map((row: { id: string }) => row.id)
      expect(ids).toContain(quotes[0])
      expect(ids).toContain(quotes[1])
      expect(ids).toContain(quotes[3])
      expect(ids).not.toContain(quotes[2])
      expect(response).toEqual(expectedPortal.adminQuotes())
      for (const query of ['page=0', 'limit=101', 'status=bogus'])
        expect(
          (await request(host, 'GET', '/api/admin/quotes?' + query)).status
        ).toBe(400)
      expect(
        (await request(host, 'GET', `/api/admin/quotes/${quotes[2]}`)).status
      ).toBe(404)
    }
  })
  it('preserves distinct list permission and detail role policy for OPERATOR', async () => {
    for (const host of hosts) {
      expect((await request(host, 'GET', '/api/admin/quotes')).status).toBe(403)
      expect(
        (await request(host, 'GET', `/api/admin/quotes/${quotes[0]}`)).status
      ).toBe(403)
    }
    await prisma.membership.update({
      where: { id: context.identity.memberships[0]! },
      data: { role: 'OPERATOR' },
    })
    for (const host of hosts) {
      expect((await request(host, 'GET', '/api/admin/quotes')).status).toBe(403)
      expect(
        (await request(host, 'GET', `/api/admin/quotes/${quotes[0]}`)).status
      ).toBe(200)
    }
  })
})
