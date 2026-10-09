import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createAdminQuotesApi } from '../../packages/frontend/src/pages/orcamentos-admin/api/admin-quotes'
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
const ids = Array.from({ length: 3 }, () => randomUUID())
const member = randomUUID()
const readPermission = randomUUID()
const marker = `quote-wave-${randomUUID()}`
const start = new Date('2033-03-01T00:00:00Z')
const end = new Date('2033-03-11T00:00:00Z')
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[52]!,
}
let adminJar: string
let clientJar: string
let publicRequests = 0
const endpoints = [
  ['PATCH', ''],
  ['DELETE', ''],
  ['GET', '/adjustments'],
  ['POST', '/adjustments'],
  ['DELETE', '/adjustments/unknown'],
  ['POST', '/calculate-late-fee'],
  ['POST', '/convert-to-rental'],
  ['POST', '/send-adjusted-quote'],
] as const
const quotePath = (id = ids[0]!) => `/api/admin/quotes/${id}`
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
  }
}
async function publicRequest(
  host: string,
  body: unknown,
  jar = '',
  headers: Record<string, string> = {},
  query = ''
) {
  return request(host, 'POST', '/api/quotes' + query, body, jar, {
    'x-platform-host-kind': 'tenant',
    'x-platform-tenant-slug': context.alfa.slug,
    'x-platform-origin': `https://${context.alfa.slug}.platform.test`,
    'x-platform-client-ip':
      context.directory.ips[53 + Math.floor(publicRequests++ / 4)]!,
    ...headers,
  })
}
async function owned() {
  return (
    await prisma.quote.findMany({
      where: {
        name: marker,
        tenantId: { in: [context.alfa.id, context.bravo.id] },
      },
      select: { id: true },
    })
  ).map((row) => row.id)
}
async function cleanup() {
  const quoteIds = await owned()
  const rentalIds = (
    await prisma.rentals.findMany({
      where: { quoteId: { in: quoteIds } },
      select: { id: true },
    })
  ).map((row) => row.id)
  await prisma.outboxEvent.deleteMany({
    where: {
      tenantId: { in: [context.alfa.id, context.bravo.id] },
      aggregateId: { in: [...quoteIds, ...rentalIds] },
    },
  })
  await prisma.payment.deleteMany({
    where: {
      OR: [{ quoteId: { in: quoteIds } }, { rentalId: { in: rentalIds } }],
    },
  })
  await prisma.rentals.deleteMany({ where: { id: { in: rentalIds } } })
  await prisma.quoteAdjustment.deleteMany({
    where: { quoteId: { in: quoteIds } },
  })
  await prisma.quote.deleteMany({ where: { id: { in: quoteIds } } })
}
async function snapshot() {
  return {
    quotes: await prisma.quote.findMany({
      where: { name: marker },
      orderBy: { id: 'asc' },
    }),
    items: await prisma.quoteItem.findMany({
      where: { quoteId: { in: await owned() } },
      orderBy: { id: 'asc' },
    }),
    adjustments: await prisma.quoteAdjustment.findMany({
      where: { quoteId: { in: await owned() } },
      orderBy: { id: 'asc' },
    }),
    payments: await prisma.payment.findMany({
      where: { tenantId: context.alfa.id },
      orderBy: { id: 'asc' },
    }),
    rentals: await prisma.rentals.findMany({
      where: { tenantId: context.alfa.id },
      orderBy: { id: 'asc' },
    }),
    outbox: await prisma.outboxEvent.findMany({
      where: { tenantId: context.alfa.id },
      orderBy: { id: 'asc' },
    }),
  }
}
async function charge(
  status: 'PENDING' | 'PAID' | 'REFUNDED' = 'PENDING',
  issued = false
) {
  return prisma.payment.create({
    data: {
      tenantId: context.alfa.id,
      quoteId: ids[0],
      amount: '100.50',
      method: 'PIX',
      type: 'DEPOSIT',
      status,
      dueDate: end,
      ...(issued ? { transactionId: marker } : {}),
    },
  })
}
const adjustment = {
  category: 'OTHER',
  amount: 1.005,
  justification: '  revisão de valor  ',
}
const publicBody = {
  customerName: marker,
  customerEmail: 'quote-fixture@example.test',
  customerPhone: '',
  deliveryType: 'PICKUP',
  items: [
    {
      equipmentId: context.alfa.equipmentIds[0],
      quantity: 1,
      days: 3,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      pricePerDay: 0.01,
      total: 0.03,
    },
  ],
  total: 0.03,
}
beforeAll(async () => {
  clientJar = await signInParityUser(context, edge, 0)
  adminJar = await signInParityUser(context, edge, 1)
  await prisma.membership.create({
    data: {
      id: member,
      tenantId: context.alfa.id,
      userId: context.identity.users[1]!.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
})
beforeEach(async () => {
  await cleanup()
  await prisma.membership.update({
    where: { id: member },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
  for (let index = 0; index < 3; index++) {
    const tenant = index === 2 ? context.bravo : context.alfa
    await prisma.quote.create({
      data: {
        id: ids[index]!,
        tenantId: tenant.id,
        userId: context.identity.users[index === 2 ? 1 : 0]!.id,
        name: marker,
        email: 'quote-fixture@example.test',
        phone: '',
        total: '100.50',
        finalTotal: '100.50',
        originalTotal: '100.50',
        deliveryFee: '0.50',
        status: 'PENDING',
        paymentTerms: 'UPFRONT',
        startDate: start,
        endDate: end,
        items: {
          create: {
            tenantId: tenant.id,
            equipmentId: tenant.equipmentIds[0]!,
            quantity: 1,
            days: 10,
            pricePerDay: '10',
            total: '100',
            startDate: start,
            endDate: end,
          },
        },
      },
    })
  }
})
afterAll(async () => {
  await cleanup()
  await prisma.permission.deleteMany({
    where: { id: readPermission },
  })
  await prisma.membership.deleteMany({ where: { id: member } })
  await prisma.$disconnect()
  await pool.end()
})

/** Respostas completas esperadas das leituras de orçamento, montadas da fixture (onda 135, B2). */
const expectedQuote = {
  adjustments(createdId: string): unknown {
    return {
      status: 200,
      cache: null,
      body: {
        adjustments: [
          {
            id: createdId,
            tenantId: context.alfa.id,
            quoteId: ids[0],
            category: 'OTHER',
            amount: 1.01,
            justification: 'revisão de valor',
            createdBy: context.identity.users[1]!.id,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            sentEmailAt: null,
            sentEmailTo: null,
            sentWhatsappAt: null,
            sentWhatsappTo: null,
            createdByUser: {
              id: context.identity.users[1]!.id,
              name: 'fixture-private-customer',
              email: context.identity.users[1]!.email,
              image: null,
            },
          },
        ],
      },
    }
  },
  lateFee(): unknown {
    return {
      status: 200,
      cache: 'no-store',
      body: {
        lateFee: 2.01,
        daysLate: 3,
        calculationMethod: 'fixed',
        config: { fixedAmount: 2.005 },
        baseValue: 100.5,
        endDate: end.toISOString(),
        calculationDate: '2033-03-14T00:00:00.000Z',
      },
    }
  },
}
describe('quote mutation parity through both compiled HTTP hosts and FORCE RLS', () => {
  it.each(hosts)(
    'consumidor de orçamentos conserva detalhe, reajuste e histórico no host %s',
    async (host) => {
      const api = createAdminQuotesApi(
        createHttpClient({
          baseUrl: host,
          getHeaders: () => ({
            ...edge,
            Cookie: adminJar,
            'x-tenant-id': context.alfa.id,
            Origin: 'https://app.platform.test',
            'Sec-Fetch-Site': 'same-origin',
          }),
        })
      )
      expect((await api.get(ids[0]!)).status).toBe(200)
      const added = await api.addAdjustment(ids[0]!, {
        body: JSON.stringify({
          category: 'TRAVEL',
          amount: 10,
          justification: 'Entrega extra',
          sendEmail: false,
          sendWhatsapp: false,
        }),
      })
      expect(added.status).toBe(202)
      expect((await api.adjustments(ids[0]!)).data.adjustments).toHaveLength(1)
      const adjustmentId = (await api.adjustments(ids[0]!)).data
        .adjustments![0]!.id
      const adjustmentSnapshot = await snapshot()
      expect((await api.removeAdjustment(ids[0]!, adjustmentId)).status).toBe(
        409
      )
      expect(await snapshot()).toEqual(adjustmentSnapshot)
      await charge()
      const before = await snapshot()
      expect((await api.remove(ids[0]!)).status).toBe(409)
      expect(await snapshot()).toEqual(before)
      expect((await api.get(ids[2]!)).status).toBe(404)
    }
  )
  it.each(endpoints)(
    '%s %s rejects missing session before payload',
    async (method, suffix) => {
      const before = await snapshot()
      for (const host of hosts)
        expect(
          (await request(host, method, quotePath() + suffix, '{', '')).status
        ).toBe(401)
      expect(await snapshot()).toEqual(before)
    }
  )
  it.each(endpoints)(
    '%s %s requires explicit company selection',
    async (method, suffix) => {
      for (const host of hosts)
        expect(
          (
            await request(host, method, quotePath() + suffix, '{', adminJar, {
              'x-tenant-id': '',
            })
          ).status
        ).toBe(409)
    }
  )
  it.each(endpoints)(
    '%s %s uses tenant membership rather than global ADMIN',
    async (method, suffix) => {
      for (const host of hosts)
        expect(
          (await request(host, method, quotePath() + suffix, '{', clientJar))
            .status
        ).toBe(403)
    }
  )
  it.each(endpoints.filter(([method]) => method !== 'GET'))(
    '%s %s rejects sibling origin before malformed JSON',
    async (method, suffix) => {
      const before = await snapshot()
      for (const host of hosts)
        expect(
          (
            await request(host, method, quotePath() + suffix, '{', adminJar, {
              Origin: `https://${context.bravo.slug}.platform.test`,
              'Sec-Fetch-Site': 'same-site',
            })
          ).status
        ).toBe(403)
      expect(await snapshot()).toEqual(before)
    }
  )
  it('revalidates a revoked membership on every mutation', async () => {
    await prisma.membership.update({
      where: { id: member },
      data: { status: 'REVOKED' },
    })
    for (const [method, suffix] of endpoints.filter(
      ([method]) => method !== 'GET'
    ))
      for (const host of hosts)
        expect(
          (await request(host, method, quotePath() + suffix, '{}')).status
        ).toBe(403)
  })
  it.each(endpoints)(
    '%s %s does not disclose foreign quotes or adjustments',
    async (method, suffix) => {
      const body = suffix === '/adjustments' ? adjustment : {}
      const before = await snapshot()
      for (const host of hosts)
        expect(
          (await request(host, method, quotePath(ids[2]) + suffix, body)).status
        ).toBe(404)
      expect(await snapshot()).toEqual(before)
    }
  )
  it('keeps role-specific access instead of treating all staff as admin', async () => {
    await prisma.membership.update({
      where: { id: member },
      data: { role: 'OPERATOR' },
    })
    for (const host of hosts) {
      expect(
        (await request(host, 'PATCH', quotePath(), { adminNotes: 'note' }))
          .status
      ).toBe(200)
      expect((await request(host, 'DELETE', quotePath())).status).toBe(403)
      expect(
        (await request(host, 'POST', quotePath() + '/convert-to-rental')).status
      ).toBe(403)
    }
    await prisma.membership.update({
      where: { id: member },
      data: { role: 'FINANCIAL' },
    })
    for (const host of hosts) {
      expect(
        (await request(host, 'POST', quotePath() + '/adjustments', adjustment))
          .status
      ).toBe(202)
      expect((await request(host, 'PATCH', quotePath(), '{')).status).toBe(403)
    }
  })
  it('checks QUOTES/READ and WRITE independently for operator actions', async () => {
    await prisma.membership.update({
      where: { id: member },
      data: { role: 'OPERATOR' },
    })
    for (const host of hosts)
      expect(
        (await request(host, 'POST', quotePath() + '/calculate-late-fee'))
          .status
      ).toBe(403)
    await prisma.permission.create({
      data: {
        id: readPermission,
        tenantId: context.alfa.id,
        role: 'OPERATOR',
        module: 'QUOTES',
        action: 'READ',
      },
    })
    for (const host of hosts) {
      expect(
        (await request(host, 'POST', quotePath() + '/calculate-late-fee'))
          .status
      ).toBe(200)
      expect(
        (await request(host, 'DELETE', quotePath() + '/adjustments/unknown'))
          .status
      ).toBe(403)
    }
    await prisma.permission.deleteMany({
      where: { id: readPermission },
    })
  })
  it.each(hosts)(
    '%s stores cent rounding, trimmed justification and immutable history with a queued event',
    async (host) => {
      const result = await request(
        host,
        'POST',
        quotePath() + '/adjustments',
        adjustment
      )
      expect(result).toMatchObject({
        status: 202,
        body: {
          adjustment: {
            amount: 1.01,
            justification: 'revisão de valor',
            createdBy: context.identity.users[1]!.id,
          },
          quote: { originalTotal: 100.5, finalTotal: 101.51 },
          emailStatus: 'queued',
          whatsappStatus: 'unavailable',
        },
      })
      // A lista explícita esperada (o ajuste recém-criado), em cada host (onda 135, B2).
      for (const other of hosts)
        expect(
          await request(other, 'GET', quotePath() + '/adjustments')
        ).toEqual(expectedQuote.adjustments(result.body.adjustment.id))
      const before = await snapshot()
      for (const other of hosts)
        expect(
          await request(
            other,
            'DELETE',
            quotePath() + '/adjustments/' + result.body.adjustment.id
          )
        ).toMatchObject({
          status: 409,
          body: { code: 'ADJUSTMENT_HISTORY_PRESERVED' },
        })
      expect(await snapshot()).toEqual(before)
      expect(
        await prisma.outboxEvent.count({
          where: { aggregateId: ids[0], topic: 'quote.adjustment.notify' },
        })
      ).toBe(1)
    }
  )
  it('serializes adjustments arriving at different hosts without losing a cent', async () => {
    // Duas requisições reais e simultâneas: raiz e API, ou a API duas vezes sem a raiz (onda 135, B2).
    const responses = await Promise.all(
      [0, 1]
        .map((index) => rotatingTarget(context, index))
        .map((host, index) =>
          request(host, 'POST', quotePath() + '/adjustments', {
            ...adjustment,
            amount: index + 1.005,
            sendEmail: false,
            sendWhatsapp: false,
          })
        )
    )
    for (const response of responses)
      expect(response).toMatchObject({
        status: 202,
        body: { emailStatus: 'not_requested', whatsappStatus: 'not_requested' },
      })
    expect(
      Number(
        (await prisma.quote.findUniqueOrThrow({ where: { id: ids[0] } }))
          .finalTotal
      )
    ).toBe(103.52)
    expect(
      await prisma.quoteAdjustment.count({ where: { quoteId: ids[0] } })
    ).toBe(2)
    expect(
      await prisma.outboxEvent.count({ where: { aggregateId: ids[0] } })
    ).toBe(2)
  })
  it.each(hosts)(
    '%s replaces freight rather than counting it twice',
    async (host) => {
      expect(
        (
          await request(host, 'POST', quotePath() + '/adjustments', {
            ...adjustment,
            category: 'TRAVEL',
            amount: 10.005,
          })
        ).body.quote.finalTotal
      ).toBe(110.01)
      const row = await prisma.quote.findUniqueOrThrow({
        where: { id: ids[0] },
      })
      expect(Number(row.deliveryFee)).toBe(10.01)
      expect(Number(row.total)).toBe(110.01)
    }
  )
  it.each(hosts)(
    '%s reprices only an unissued current charge in the same transaction',
    async (host) => {
      const payment = await charge()
      expect(
        (
          await request(host, 'POST', quotePath() + '/adjustments', {
            ...adjustment,
            amount: 10.005,
          })
        ).status
      ).toBe(202)
      expect(
        Number(
          (
            await prisma.payment.findUniqueOrThrow({
              where: { id: payment.id },
            })
          ).amount
        )
      ).toBe(110.51)
    }
  )
  it('refuses changes to issued obligations with no partial adjustment or outbox', async () => {
    await charge('PENDING', true)
    const before = await snapshot()
    for (const host of hosts)
      expect(
        await request(host, 'POST', quotePath() + '/adjustments', adjustment)
      ).toMatchObject({
        status: 409,
        body: { code: 'PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION' },
      })
    expect(await snapshot()).toEqual(before)
  })
  it('rejects unsupported patches and final values without justification before writing', async () => {
    const before = await snapshot()
    for (const host of hosts)
      for (const body of [
        { tenantId: context.bravo.id },
        { finalTotal: 90 },
        { finalTotal: -1, priceAdjustmentReason: 'reason' },
      ])
        expect((await request(host, 'PATCH', quotePath(), body)).status).toBe(
          400
        )
    expect(await snapshot()).toEqual(before)
  })
  it.each(hosts)(
    '%s applies a manual final value in cents with its historical adjustment',
    async (host) => {
      expect(
        (
          await request(host, 'PATCH', quotePath(), {
            finalTotal: 110.505,
            priceAdjustmentReason: 'revisão manual',
          })
        ).status
      ).toBe(200)
      const quote = await prisma.quote.findUniqueOrThrow({
        where: { id: ids[0] },
      })
      expect(Number(quote.finalTotal)).toBe(110.51)
      expect(
        await prisma.quoteAdjustment.count({ where: { quoteId: ids[0] } })
      ).toBe(1)
    }
  )
  it('queues adjusted delivery idempotently across hosts and ignores an unused request body', async () => {
    for (const host of hosts)
      expect(
        (await request(host, 'POST', quotePath() + '/send-adjusted-quote', '{'))
          .status
      ).toBe(409)
    expect(
      (
        await request(
          hosts[0]!,
          'POST',
          quotePath() + '/adjustments',
          adjustment
        )
      ).status
    ).toBe(202)
    // Duas requisições reais e simultâneas: raiz e API, ou a API duas vezes sem a raiz (onda 135, B2).
    const results = await Promise.all(
      [0, 1]
        .map((index) => rotatingTarget(context, index))
        .map((host) =>
          request(host, 'POST', quotePath() + '/send-adjusted-quote', '{')
        )
    )
    for (const result of results)
      expect(result).toMatchObject({
        status: 202,
        body: { success: true, emailStatus: 'queued' },
      })
    const rows = await prisma.outboxEvent.findMany({
      where: {
        aggregateId: ids[0],
        topic: 'quote.adjustment.notify',
      },
    })
    expect(rows).toHaveLength(2)
    const sent = rows.filter(
      (row) => !(row.payload as { adjustmentId?: string }).adjustmentId
    )
    expect(sent).toHaveLength(1)
    expect(sent[0]!.status).toBe('PENDING')
    expect(sent[0]!.payload).toMatchObject({ quoteId: ids[0], sendEmail: true })
    await prisma.quote.update({
      where: { id: ids[0] },
      data: { status: 'REJECTED' },
    })
    for (const host of hosts)
      expect(
        (await request(host, 'POST', quotePath() + '/send-adjusted-quote'))
          .status
      ).toBe(409)
  })
  it('simulates a rounded late fee without saving financial fields', async () => {
    const before = await snapshot()
    const body = {
      currentDate: '2033-03-14T00:00:00Z',
      config: { fixedAmount: 2.005 },
    }
    for (const host of hosts)
      expect(
        await request(host, 'POST', quotePath() + '/calculate-late-fee', body)
      ).toEqual(expectedQuote.lateFee())
    expect(await snapshot()).toEqual(before)
    for (const host of hosts)
      for (const input of ['{', { config: { minAmount: 10, maxAmount: 1 } }])
        expect(
          (
            await request(
              host,
              'POST',
              quotePath() + '/calculate-late-fee',
              input
            )
          ).status
        ).toBe(400)
    await prisma.quote.update({
      where: { id: ids[0] },
      data: { endDate: null },
    })
    for (const host of hosts)
      expect(
        (await request(host, 'POST', quotePath() + '/calculate-late-fee'))
          .status
      ).toBe(400)
  })
  it('approves an upfront quote without creating an unpaid rental', async () => {
    for (const host of hosts)
      expect(
        (await request(host, 'PATCH', quotePath(), { status: 'APPROVED' }))
          .status
      ).toBe(200)
    const quote = await prisma.quote.findUniqueOrThrow({
      where: { id: ids[0] },
    })
    expect(quote.status).toBe('APPROVED')
    expect(quote.approvedBy).toBe(context.identity.users[1]!.id)
    expect(await prisma.rentals.count({ where: { quoteId: ids[0] } })).toBe(0)
    expect(
      await prisma.outboxEvent.count({ where: { aggregateId: ids[0] } })
    ).toBe(1)
    for (const host of hosts)
      expect(
        (await request(host, 'POST', quotePath() + '/convert-to-rental', {}))
          .status
      ).toBe(400)
  })
  it('converts a settled quote once across hosts, preserving refunded history and never issuing boleto', async () => {
    await charge('REFUNDED')
    await charge('PAID')
    await prisma.quote.update({
      where: { id: ids[0] },
      data: { status: 'APPROVED', approvedAt: new Date() },
    })
    // Duas conversões reais e simultâneas: raiz e API, ou a API duas vezes sem a raiz (onda 135, B2).
    const results = await Promise.all(
      [0, 1]
        .map((index) => rotatingTarget(context, index))
        .map((host) =>
          request(host, 'POST', quotePath() + '/convert-to-rental', {
            generateBoleto: true,
          })
        )
    )
    for (const result of results)
      expect(result).toMatchObject({
        status: 201,
        body: { boletoGenerated: false },
      })
    // parity-scan: a conversão é única; a segunda chamada real devolve a mesma locação.
    expect(results[1]!.body.rentalId).toBe(results[0]!.body.rentalId)
    const rentals = await prisma.rentals.findMany({
      where: { quoteId: ids[0] },
    })
    expect(rentals).toHaveLength(1)
    expect(rentals[0]!.status).toBe('PENDING')
    expect(
      await prisma.payment.count({
        where: { rentalId: rentals[0]!.id, quoteId: null },
      })
    ).toBe(2)
    expect(
      await prisma.quote.findUniqueOrThrow({ where: { id: ids[0] } })
    ).toMatchObject({
      status: 'COMPLETED',
      convertedToRentalId: rentals[0]!.id,
    })
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: ids[0], topic: 'quote.status.notify' },
      })
    ).toBe(1)
    const convertedEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: ids[0], topic: 'quote.status.notify' },
    })
    expect(convertedEvent.payload).toEqual({
      quoteId: ids[0],
      status: 'COMPLETED',
    })
    const before = await snapshot()
    for (const host of hosts) {
      expect(
        (await request(host, 'POST', quotePath() + '/adjustments', adjustment))
          .status
      ).toBe(409)
      expect((await request(host, 'DELETE', quotePath())).status).toBe(409)
    }
    expect(await snapshot()).toEqual(before)
  })
  it('approval with AT_END uses the same atomic rental conversion', async () => {
    await prisma.quote.update({
      where: { id: ids[0] },
      data: { paymentTerms: 'AT_END' },
    })
    const result = await request(hosts.at(-1)!, 'PATCH', quotePath(), {
      status: 'APPROVED',
    })
    expect(result.status).toBe(200)
    const rentals = await prisma.rentals.findMany({
      where: { quoteId: ids[0] },
    })
    expect(rentals).toHaveLength(1)
    for (const host of hosts)
      expect(
        (await request(host, 'POST', quotePath() + '/convert-to-rental')).body
          .rentalId
      ).toBe(rentals[0]!.id)
  })
  it('preserves a quote with charges and deletes only a bare quote with its items', async () => {
    await charge()
    for (const host of hosts)
      expect((await request(host, 'DELETE', quotePath())).status).toBe(409)
    expect(
      await request(hosts.at(-1)!, 'DELETE', quotePath(ids[1]))
    ).toMatchObject({
      status: 200,
      body: { message: 'Quote deleted successfully' },
    })
    expect(await prisma.quoteItem.count({ where: { quoteId: ids[1] } })).toBe(0)
    expect((await request(hosts[0]!, 'DELETE', quotePath(ids[1]))).status).toBe(
      404
    )
  })
  it.each(hosts)(
    '%s rolls back adjustment and charge repricing if durable notification fails',
    async (host) => {
      await charge()
      const before = await snapshot()
      const fault = `quote_fault_${randomUUID().replaceAll('-', '')}`
      try {
        await pool.query(
          `CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture-private-database-cause' USING ERRCODE='42501'; END $$`
        )
        await pool.query(
          `CREATE TRIGGER ${fault} AFTER INSERT ON outbox_events FOR EACH ROW WHEN (NEW."tenantId" = '${context.alfa.id}') EXECUTE FUNCTION ${fault}()`
        )
        expect(
          await request(host, 'POST', quotePath() + '/adjustments', adjustment)
        ).toMatchObject({
          status: 500,
          body: { error: 'Erro ao criar reajuste' },
        })
        expect(await snapshot()).toEqual(before)
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS ${fault} ON outbox_events`)
        await pool.query(`DROP FUNCTION IF EXISTS ${fault}()`)
      }
    }
  )
  it.each(hosts)(
    '%s hides internal deletion failure and leaves the quote intact',
    async (host) => {
      const before = await snapshot()
      const fault = `quote_delete_${randomUUID().replaceAll('-', '')}`
      try {
        await pool.query(
          `CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture-private-database-cause' USING ERRCODE='42501'; END $$`
        )
        await pool.query(
          `CREATE TRIGGER ${fault} AFTER DELETE ON quotes FOR EACH ROW WHEN (OLD.id = '${ids[1]}') EXECUTE FUNCTION ${fault}()`
        )
        expect(await request(host, 'DELETE', quotePath(ids[1]))).toMatchObject({
          status: 500,
          body: { error: 'Internal server error' },
        })
        expect(await snapshot()).toEqual(before)
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS ${fault} ON quotes`)
        await pool.query(`DROP FUNCTION IF EXISTS ${fault}()`)
      }
    }
  )
  it.each(hosts)(
    '%s creates a public quote from catalog prices, without trusting submitted money',
    async (host) => {
      const result = await publicRequest(host, publicBody)
      expect(result.status).toBe(201)
      expect(result.body).toMatchObject({
        tenantId: context.alfa.id,
        name: marker,
        userId: null,
        status: 'PENDING',
        paymentTerms: 'UPFRONT',
      })
      expect(Number(result.body.total)).toBe(51.75)
      expect(Number(result.body.items[0].pricePerDay)).toBe(17.25)
      expect(result.body.quoteCode).toMatch(/^Q-\d{4}-\d+$/)
      expect(
        new Date(result.body.validUntil).getTime() -
          new Date(result.body.createdAt).getTime()
      ).toBeGreaterThan(6 * 86400_000)
      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateId: result.body.id,
            topic: 'quote.created.notify',
            status: 'PENDING',
          },
        })
      ).toBe(1)
    }
  )
  it('uses the optional real session only for a valid CLIENT membership', async () => {
    for (const host of hosts) {
      const result = await publicRequest(host, publicBody, clientJar)
      expect(result.status).toBe(201)
      expect(result.body.userId).toBe(context.identity.users[0]!.id)
      expect((await publicRequest(host, publicBody, adminJar)).status).toBe(404)
    }
  })
  it('isolates public creation by tenant host before schema or effects', async () => {
    const before = await snapshot()
    for (const host of hosts) {
      expect(
        (
          await publicRequest(host, {
            ...publicBody,
            tenantSlug: context.bravo.slug,
          })
        ).status
      ).toBe(400)
      expect(
        (
          await publicRequest(host, {}, '', {
            'x-platform-host-kind': 'app',
            'x-platform-tenant-slug': '',
            'x-platform-origin': 'https://app.platform.test',
          })
        ).status
      ).toBe(409)
      expect(
        (
          await publicRequest(
            host,
            publicBody,
            '',
            {},
            '?tenantSlug=' + context.bravo.slug
          )
        ).status
      ).toBe(400)
      expect(
        (
          await publicRequest(host, '{', '', {
            Origin: `https://${context.bravo.slug}.platform.test`,
          })
        ).status
      ).toBe(403)
      expect(
        (
          await publicRequest(host, {
            ...publicBody,
            items: [
              {
                equipmentId: context.bravo.equipmentIds[0],
                quantity: 1,
                days: 3,
              },
            ],
          })
        ).status
      ).toBe(404)
    }
    expect(await snapshot()).toEqual(before)
  })
  it('serializes public quote codes across hosts and stores each notification atomically', async () => {
    // Dois pedidos públicos reais e simultâneos: raiz e API, ou a API duas vezes sem a raiz (onda 135, B2).
    const results = await Promise.all(
      [0, 1]
        .map((index) => rotatingTarget(context, index))
        .map((host) => publicRequest(host, publicBody))
    )
    for (const result of results) expect(result.status).toBe(201)
    // parity-scan: dois pedidos reais recebem códigos públicos distintos.
    expect(new Set(results.map((result) => result.body.quoteCode)).size).toBe(2)
    for (const result of results)
      expect(
        await prisma.outboxEvent.count({
          where: { aggregateId: result.body.id, topic: 'quote.created.notify' },
        })
      ).toBe(1)
  })
})
