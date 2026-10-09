import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { parityTargets } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const a = context.alfa.id,
  b = context.bravo.id
const admins = context.identity.users.slice(1).map((user) => user.id)
const client = context.identity.users[0]!.id
const memberIds = [randomUUID(), randomUUID()]
const quotes: string[] = [],
  rentals: string[] = [],
  conversations: string[] = []
const jars: string[] = []
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[59]!,
}
const keys = [
  'quote_pending',
  'boleto_not_generated',
  'boleto_not_sent',
  'payment_pending',
  'approved_no_rental',
  'checkin_pending',
  'return_pending',
  'rental_overdue',
  'contract_pending',
].map((key) => `admin:sync:${key}`)
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000)
let baselineQuotes = 0,
  baselineRentals = 0
async function quote(tenantId = a, data: Record<string, unknown> = {}) {
  const row = await prisma.quote.create({
    data: {
      id: randomUUID(),
      tenantId,
      name: 'Local communication fixture',
      email: 'local@example.test',
      phone: 'local-phone',
      total: '10',
      status: 'PENDING',
      ...data,
    },
  })
  quotes.push(row.id)
  return row.id
}
async function alerts() {
  return prisma.notification.findMany({
    where: {
      tenantId: { in: [a, b] },
      OR: keys.map((key) => ({
        metadata: { path: ['dedupeKey'], equals: key },
      })),
    },
    orderBy: [{ userId: 'asc' }, { title: 'asc' }],
  })
}
async function clearAlerts() {
  await prisma.notification.deleteMany({
    where: { id: { in: (await alerts()).map((row) => row.id) } },
  })
}
async function request(
  host: string,
  sync = false,
  extra: Record<string, string> = {},
  cookie = jars[1]!
) {
  const r = await fetch(
    host + (sync ? '/api/admin/notifications/sync' : '/api/admin/badges'),
    {
      method: sync ? 'POST' : 'GET',
      headers: {
        ...edge,
        Origin: edge['x-platform-origin'],
        Cookie: cookie,
        'x-tenant-id': a,
        ...extra,
      },
      ...(sync ? { body: 'body is ignored' } : {}),
    }
  )
  const text = await r.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: r.status, body }
}
beforeAll(async () => {
  for (let index = 0; index < 3; index++)
    jars.push(await signInParityUser(context, edge, index))
  baselineQuotes = await prisma.quote.count({
    where: { tenantId: a, status: 'PENDING' },
  })
  baselineRentals = await prisma.rentals.count({
    where: {
      tenantId: a,
      status: { in: ['PENDING', 'PENDING_RETURN'] },
      quoteId: { not: null },
    },
  })
  await prisma.membership.createMany({
    data: admins.map((userId, index) => ({
      id: memberIds[index]!,
      tenantId: a,
      userId,
      role: 'ADMIN',
      status: 'ACTIVE',
    })),
  })
  await quote(a, { createdAt: ago(5) })
  await quote(a, { createdAt: ago(5) })
  await quote(a, { approvedAt: ago(3), cpf: 'fixture', createdAt: ago(5) })
  const unsent = await quote(a, { approvedAt: ago(3), cpf: 'fixture' })
  const unpaid = await quote(a, { approvedAt: ago(3), cnpj: 'fixture' })
  await prisma.payment.createMany({
    data: [
      {
        id: randomUUID(),
        tenantId: a,
        quoteId: unsent,
        amount: '10',
        dueDate: ago(1),
        method: 'BOLETO',
        type: 'DEPOSIT',
        status: 'PENDING',
        metadata: { boletoSentAt: 'invalid-date' },
      },
      {
        id: randomUUID(),
        tenantId: a,
        quoteId: unpaid,
        amount: '10',
        dueDate: ago(1),
        method: 'BOLETO',
        type: 'DEPOSIT',
        status: 'OVERDUE',
        metadata: { boletoSentAt: ago(25).toISOString() },
      },
    ],
  })
  await quote(a, { status: 'APPROVED', updatedAt: ago(5) })
  for (const status of ['PENDING', 'PENDING_RETURN', 'ACTIVE'] as const) {
    const quoteId = await quote(a, { status: 'REJECTED' })
    const rental = await prisma.rentals.create({
      data: {
        id: randomUUID(),
        tenantId: a,
        userid: client,
        quoteId,
        total: '10',
        status,
        startdate: ago(3),
        enddate:
          status === 'PENDING' ? new Date(Date.now() + 86_400_000) : ago(3),
        checkInAt: status === 'ACTIVE' ? ago(5) : null,
      },
    })
    rentals.push(rental.id)
  }
  const orphan = await prisma.rentals.create({
    data: {
      id: randomUUID(),
      tenantId: a,
      userid: client,
      total: '10',
      status: 'PENDING',
      startdate: new Date(Date.now() + 86_400_000),
      enddate: new Date(Date.now() + 172_800_000),
    },
  })
  rentals.push(orphan.id)
  await quote(b, { createdAt: ago(5) })
  for (const [index, directions] of [
    [],
    ['INBOUND'],
    ['INBOUND', 'OUTBOUND'],
    ['OUTBOUND', 'INBOUND'],
    ['INBOUND'],
  ].entries()) {
    const tenantId = index === 4 ? b : a
    const row = await prisma.whatsAppConversation.create({
      data: {
        id: randomUUID(),
        tenantId,
        phone: `fixture-${randomUUID()}`,
        messages: {
          create: directions.map((direction, number) => ({
            tenantId,
            direction: direction as 'INBOUND' | 'OUTBOUND',
            body: 'local message',
            timestamp: new Date(Date.now() - 10_000 + number * 1000),
          })),
        },
      },
    })
    conversations.push(row.id)
  }
})
beforeEach(async () => {
  await clearAlerts()
  await prisma.membership.updateMany({
    where: { id: { in: memberIds } },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
})
afterAll(async () => {
  await clearAlerts()
  await prisma.whatsAppConversation.deleteMany({
    where: { id: { in: conversations } },
  })
  await prisma.payment.deleteMany({ where: { quoteId: { in: quotes } } })
  await prisma.rentals.deleteMany({ where: { id: { in: rentals } } })
  await prisma.quote.deleteMany({ where: { id: { in: quotes } } })
  await prisma.membership.deleteMany({ where: { id: { in: memberIds } } })
  await prisma.$disconnect()
  await pool.end()
})

describe.each(hosts)('administrative communications HTTP %s', (host) => {
  it('preserves badge DTO, pending filters, linked-only rentals and latest WhatsApp message', async () => {
    expect(await request(host)).toEqual({
      status: 200,
      body: {
        email: 0,
        quotes: baselineQuotes + 5,
        rentals: baselineRentals + 2,
        whatsapp: 2,
      },
    })
  })
  it('accepts tenant OPERATOR for badges but denies sync even if the global role differs', async () => {
    expect((await request(host, false, { 'x-tenant-id': b })).status).toBe(200)
    expect(await request(host, true, { 'x-tenant-id': b })).toEqual({
      status: 403,
      body: { error: 'Acesso negado' },
    })
    expect(await request(host, false, {}, jars[0]!)).toEqual({
      status: 403,
      body: { error: 'Acesso negado' },
    })
  })
  it.each([false, true])(
    'refuses sibling origin before effects, including GET (sync=%s)',
    async (sync) => {
      expect(
        (await request(host, sync, { Origin: 'https://bravo.platform.test' }))
          .status
      ).toBe(403)
      expect(await alerts()).toEqual([])
    }
  )
  it.each([false, true])(
    'preserves unauthenticated envelope (sync=%s)',
    async (sync) => {
      const result = await request(host, sync, {}, '')
      expect(result.status).toBe(401)
      expect(result.body).toEqual({ error: 'Authentication required' })
    }
  )
  it('revalidates revoked membership for an existing session', async () => {
    await prisma.membership.update({
      where: { id: memberIds[0]! },
      data: { status: 'REVOKED' },
    })
    expect((await request(host, true)).status).toBe(403)
    expect(await alerts()).toEqual([])
  })
  it('coalesces resources into nine keys for each active ADMIN, including a read alert', async () => {
    expect(await request(host, true)).toEqual({
      status: 200,
      body: { success: true, results: { created: 18, checks: 10 } },
    })
    const rows = await alerts()
    expect(rows).toHaveLength(18)
    expect(new Set(rows.map((row) => row.tenantId))).toEqual(new Set([a]))
    expect(new Set(rows.map((row) => row.userId))).toEqual(new Set(admins))
    for (const userId of admins)
      expect(
        rows
          .filter((row) => row.userId === userId)
          .map((row) => (row.metadata as { dedupeKey: string }).dedupeKey)
          .sort()
      ).toEqual([...keys].sort())
    await prisma.notification.update({
      where: { id: rows[0]!.id },
      data: { isRead: true, readAt: new Date() },
    })
    expect(await request(host, true)).toEqual({
      status: 200,
      body: { success: true, results: { created: 0, checks: 10 } },
    })
    expect(await alerts()).toHaveLength(18)
  })
  it('excludes another tenant and inactive ADMIN recipients', async () => {
    await prisma.membership.update({
      where: { id: memberIds[1]! },
      data: { status: 'REVOKED' },
    })
    const result = await request(host, true)
    expect(result).toEqual({
      status: 200,
      body: { success: true, results: { created: 9, checks: 10 } },
    })
    expect(new Set((await alerts()).map((row) => row.userId))).toEqual(
      new Set([admins[0]!])
    )
  })
})
it('concurrent legacy/service synchronization creates one row per recipient/key through the SQL lock', async () => {
  const result = await Promise.all(hosts.map((host) => request(host, true)))
  expect(result.every((row) => row.status === 200)).toBe(true)
  expect(
    result.reduce(
      (sum, row) =>
        sum + (row.body as { results: { created: number } }).results.created,
      0
    )
  ).toBe(18)
  expect(await alerts()).toHaveLength(18)
})
