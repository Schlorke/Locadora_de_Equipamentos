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
import { PrismaClient, type Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { requireTestDatabase } from '../helpers/test-database'
import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import { signInParityUser } from './identity'
import { parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity')
const hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const member = randomUUID()
const clientMember = randomUUID()
// Tenant-wide defaults and RLS SELECTs must not inherit preventive rows left by
// cron-jobs on the shared alfa fixture. Keep the queries broad, in our own tenant.
const tenantId = 'maintenance-audit-' + randomUUID()
const categoryId = randomUUID()
const equipmentIds = [randomUUID(), randomUUID(), randomUUID()]
const maintenanceIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
const auditIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
const rentalId = randomUUID(),
  itemId = randomUUID()
const marker = 'wave51-' + randomUUID()
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[58]!,
}
const input = {
  equipmentId: equipmentIds[0],
  type: 'CORRECTIVE',
  scheduledAt: '2026-12-01T10:00:00Z',
}
const endpoints = [
  ['GET', 'maintenance'],
  ['POST', 'maintenance'],
  ['GET', 'maintenance/scheduled'],
  ['POST', 'maintenance/preventive-schedule'],
  ['PATCH', `maintenance/${maintenanceIds[0]}`],
  ['POST', `maintenance/${maintenanceIds[0]}/complete`],
  ['GET', 'audit-logs'],
] as const
let cookie = '',
  clientCookie = ''
async function request(
  host: string,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  const r = await fetch(`${host}/api/admin/${path}`, {
    method,
    headers: {
      ...edge,
      Origin: edge['x-platform-origin'],
      Cookie: cookie,
      'x-tenant-id': tenantId,
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(!['GET', 'HEAD'].includes(method)
      ? { body: typeof body === 'string' ? body : JSON.stringify(body ?? {}) }
      : {}),
  })
  return {
    status: r.status,
    body: await r.json(),
    cookie: r.headers.get('set-cookie'),
    cache: r.headers.get('cache-control'),
  }
}
const scope = { equipmentId: { in: equipmentIds } }
/** Manutenção da fixture no equipamento 0 como a listagem a serializa, montada do `reset` (onda 135, B2). */
function maintenanceRow(index: 0 | 1) {
  return {
    id: maintenanceIds[index]!,
    tenantId,
    equipmentId: equipmentIds[0]!,
    type: index ? 'INSPECTION' : 'CORRECTIVE',
    scheduledAt: index
      ? '2026-12-31T00:00:00.000Z'
      : '2026-01-01T00:00:00.000Z',
    completedAt: index ? '2026-01-02T00:00:00.000Z' : null,
    cost: index ? null : '12',
    laborCost: null,
    partsCost: null,
    description: null,
    notes: null,
    technician: null,
    status: index ? 'COMPLETED' : 'SCHEDULED',
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
    equipment: {
      id: equipmentIds[0],
      name: 'Maintenance 0',
      images: ['local.jpg'],
      category: { id: categoryId, name: 'Andaimes' },
    },
  }
}
async function reset() {
  await prisma.rental_items.deleteMany({ where: { id: itemId } })
  await prisma.rentals.deleteMany({ where: { id: rentalId } })
  await prisma.maintenance.deleteMany({ where: scope })
  await prisma.equipment.update({
    where: { id: equipmentIds[0] },
    data: { available: true, hourMeter: 120, odometer: 10 },
  })
  await prisma.maintenance.createMany({
    data: [
      {
        id: maintenanceIds[0]!,
        tenantId,
        equipmentId: equipmentIds[0]!,
        type: 'CORRECTIVE',
        scheduledAt: new Date('2026-01-01'),
        cost: 12,
      },
      {
        id: maintenanceIds[1]!,
        tenantId,
        equipmentId: equipmentIds[0]!,
        type: 'INSPECTION',
        scheduledAt: new Date('2026-12-31'),
        status: 'COMPLETED',
        completedAt: new Date('2026-01-02'),
      },
      {
        id: maintenanceIds[2]!,
        tenantId: context.bravo.id,
        equipmentId: equipmentIds[1]!,
        type: 'CORRECTIVE',
        scheduledAt: new Date('2026-01-01'),
      },
      {
        id: maintenanceIds[3]!,
        tenantId: null,
        equipmentId: equipmentIds[2]!,
        type: 'CORRECTIVE',
        scheduledAt: new Date('2026-01-01'),
      },
    ],
  })
}
beforeAll(async () => {
  cookie = await signInParityUser(context, edge, 1)
  clientCookie = await signInParityUser(context, edge, 0)
  await prisma.organization.create({
    data: {
      id: tenantId,
      slug: tenantId,
      name: 'Maintenance audit fixture',
      status: 'ACTIVE',
    },
  })
  await withTestPlatformTransaction(prisma, (tx) =>
    tx.organization.update({
      where: { id: tenantId },
      data: { access: 'FULL' },
    })
  )
  await prisma.category.create({
    data: {
      id: categoryId,
      tenantId,
      name: 'Andaimes',
      slug: tenantId,
    },
  })
  await prisma.membership.createMany({
    data: [
      {
        id: member,
        tenantId,
        userId: context.identity.users[1]!.id,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      {
        id: clientMember,
        tenantId,
        userId: context.identity.users[0]!.id,
        role: 'CLIENT',
        status: 'ACTIVE',
      },
    ],
  })
  await prisma.equipment.createMany({
    data: equipmentIds.map((id, index) => ({
      id,
      tenantId: index === 2 ? null : index === 1 ? context.bravo.id : tenantId,
      categoryId: index === 1 ? context.bravo.categoryId : categoryId,
      name: `Maintenance ${index}`,
      pricePerDay: 10,
      images: ['local.jpg'],
      hourMeter: 120,
      odometer: 10,
    })),
  })
  await prisma.auditLog.createMany({
    data: auditIds.map((id, index) => ({
      id,
      tenantId: index < 2 ? tenantId : index === 2 ? context.bravo.id : null,
      userId: context.identity.users[1]!.id,
      entity: marker,
      entityId: equipmentIds[0]!,
      action: index === 1 ? 'DELETE' : 'UPDATE',
      changes: { before: { available: true }, after: { available: false } },
      createdAt: new Date(`2026-01-0${index + 1}T12:00:00Z`),
    })),
  })
})
beforeEach(reset)
afterAll(async () => {
  try {
    await prisma.rental_items.deleteMany({ where: { id: itemId } })
    await prisma.rentals.deleteMany({ where: { id: rentalId } })
    await prisma.maintenance.deleteMany({ where: scope })
    await prisma.auditLog.deleteMany({
      where: { OR: [{ tenantId }, { id: { in: auditIds } }] },
    })
    await prisma.equipment.deleteMany({ where: { id: { in: equipmentIds } } })
    await prisma.membership.deleteMany({
      where: { id: { in: [member, clientMember] } },
    })
    await prisma.category.deleteMany({ where: { id: categoryId } })
    await prisma.organization.deleteMany({ where: { id: tenantId } })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})
/** Issues completos do Zod esperados na criação inválida (contrato de manutenção; onda 135, B2). */
function maintenanceIssues(body: unknown): unknown[] {
  const invalidType = (
    expected: string,
    received: string,
    path: string[] = []
  ) => ({
    expected,
    code: 'invalid_type',
    path,
    message: `Invalid input: expected ${expected}, received ${received}`,
  })
  const row = body as Record<string, unknown>
  if (!Object.keys(row).length)
    return [
      invalidType('string', 'undefined', ['equipmentId']),
      {
        code: 'invalid_value',
        values: ['PREVENTIVE', 'CORRECTIVE', 'INSPECTION'],
        path: ['type'],
        message:
          'Invalid option: expected one of "PREVENTIVE"|"CORRECTIVE"|"INSPECTION"',
      },
      invalidType('string', 'undefined', ['scheduledAt']),
    ]
  if (row.scheduledAt === 'invalid')
    return [{ code: 'custom', path: ['scheduledAt'], message: 'Data inválida' }]
  if (row.cost === -1)
    return [
      {
        origin: 'number',
        code: 'too_small',
        minimum: 0,
        inclusive: true,
        path: ['cost'],
        message: 'Too small: expected number to be >=0',
      },
    ]
  throw new Error('Unknown invalid maintenance fixture')
}
describe('maintenance and audit over production HTTP hosts, cookies and FORCE RLS', () => {
  it.each(endpoints)(
    '%s %s rejects missing session before malformed input',
    async (method, path) => {
      for (const host of hosts)
        expect(
          (await request(host, method, path, '{', { Cookie: '' })).status
        ).toBe(401)
      expect(await prisma.maintenance.count({ where: scope })).toBe(4)
    }
  )
  it.each(['OPERATOR', 'FINANCIAL', 'CLIENT'] as Role[])(
    'global ADMIN does not override tenant %s membership',
    async (role) => {
      try {
        await prisma.membership.update({
          where: { id: member },
          data: { role },
        })
        for (const host of hosts)
          for (const [method, path] of endpoints) {
            const r = await request(host, method, path, '{')
            expect(r.status).toBe(403)
            expect(r.body).toEqual({ error: 'Forbidden' })
          }
      } finally {
        await prisma.membership.update({
          where: { id: member },
          data: { role: 'ADMIN' },
        })
      }
    }
  )
  it('client and revoked membership cannot read or write', async () => {
    for (const host of hosts)
      expect(
        (
          await request(host, 'GET', 'maintenance', undefined, {
            Cookie: clientCookie,
          })
        ).status
      ).toBe(403)
    try {
      await prisma.membership.update({
        where: { id: member },
        data: { status: 'REVOKED' },
      })
      for (const host of hosts)
        for (const [method, path] of endpoints)
          expect((await request(host, method, path, '{')).status).toBe(403)
    } finally {
      await prisma.membership.update({
        where: { id: member },
        data: { status: 'ACTIVE' },
      })
    }
  })
  it.each(endpoints.filter(([method]) => method !== 'GET'))(
    '%s %s blocks sibling-origin mutation before effects',
    async (method, path) => {
      for (const host of hosts)
        expect(
          (
            await request(host, method, path, '{', {
              Origin: 'https://bravo.platform.test',
            })
          ).status
        ).toBe(403)
      expect(await prisma.maintenance.count({ where: scope })).toBe(4)
      expect(
        (
          await prisma.equipment.findUniqueOrThrow({
            where: { id: equipmentIds[0] },
          })
        ).available
      ).toBe(true)
    }
  )
  it('lists identical tenant DTOs and descending inclusive filters', async () => {
    const path = `maintenance?equipmentId=${equipmentIds[0]}&startDate=2026-01-01&endDate=2026-12-31`
    // Lista completa esperada, montada da fixture, em cada host (onda 135, B2).
    for (const host of hosts)
      expect(await request(host, 'GET', path)).toEqual({
        status: 200,
        body: { maintenances: [maintenanceRow(1), maintenanceRow(0)] },
        cookie: null,
        cache: null,
      })
    for (const foreign of equipmentIds.slice(1))
      for (const host of hosts)
        expect(
          (await request(host, 'GET', `maintenance?equipmentId=${foreign}`))
            .body
        ).toEqual({ maintenances: [] })
  })
  it('scheduled has active defaults and explicit status override; alerts are tenant-wide', async () => {
    for (const host of hosts) {
      const defaultResult = await request(host, 'GET', 'maintenance/scheduled')
      expect(
        defaultResult.body.maintenances.map((r: { id: string }) => r.id)
      ).toEqual([maintenanceIds[0]])
      expect(defaultResult.body.overdueAlerts).toEqual([])
      const r = await request(
        host,
        'GET',
        `maintenance/scheduled?equipmentId=${equipmentIds[1]}&status=COMPLETED&includeOverdue=true`
      )
      expect(r.body.maintenances).toEqual([])
      expect(r.body.overdueCount).toBe(1)
      expect(r.body.overdueAlerts).toEqual([
        {
          id: maintenanceIds[0],
          equipmentId: equipmentIds[0],
          equipmentName: 'Maintenance 0',
          scheduledAt: '2026-01-01T00:00:00.000Z',
          daysOverdue: expect.any(Number),
          type: 'CORRECTIVE',
        },
      ])
      expect(r.body.overdueAlerts[0].daysOverdue).toBeGreaterThan(0)
    }
  })
  it.each(['?status=UNKNOWN', '?type=UNKNOWN', '?startDate=invalid'])(
    'maintenance invalid Prisma filters preserve generic 500 %s',
    async (query) => {
      for (const host of hosts) {
        const r = await request(host, 'GET', 'maintenance' + query)
        expect(r.status).toBe(500)
        expect(r.body).toEqual({ error: 'Internal server error' })
      }
    }
  )
  it('creates scoped DTO and recomputed costs, strips extras, duplicate calls remain separate', async () => {
    const results = []
    // Duas criações reais: uma em cada host com a raiz, ou as duas na API sem ela (onda 135, B2).
    for (const host of [0, 1].map((index) => rotatingTarget(context, index))) {
      const r = await request(host, 'POST', 'maintenance', {
        ...input,
        cost: 0,
        laborCost: 2.5,
        partsCost: 0,
        description: '',
        notes: '',
        tenantId: context.bravo.id,
        status: 'COMPLETED',
      })
      expect(r.status).toBe(201)
      expect(r.body.maintenance).toMatchObject({
        tenantId,
        equipmentId: equipmentIds[0],
        status: 'SCHEDULED',
        cost: '2.5',
        laborCost: '2.5',
        partsCost: null,
        notes: '',
        description: '',
        equipment: { id: equipmentIds[0], name: 'Maintenance 0' },
      })
      expect(r.cookie).toBeNull()
      results.push(r.body.maintenance.id)
    }
    // parity-scan: duas criações reais e repetidas geram duas manutenções distintas.
    expect(new Set(results).size).toBe(2)
    expect(await prisma.maintenance.count({ where: scope })).toBe(6)
    expect(
      (
        await prisma.equipment.findUniqueOrThrow({
          where: { id: equipmentIds[0] },
        })
      ).available
    ).toBe(true)
  })
  it.each([{}, { ...input, scheduledAt: 'invalid' }, { ...input, cost: -1 }])(
    'creation preserves Zod issues and 400 %j',
    async (body) => {
      for (const host of hosts)
        expect(await request(host, 'POST', 'maintenance', body)).toEqual({
          status: 400,
          body: { error: 'Validation error', details: maintenanceIssues(body) },
          cookie: null,
          cache: null,
        })
    }
  )
  it('foreign/unassigned ownership is 404; PATCH looks up before body, complete parses first', async () => {
    for (const host of hosts)
      for (const index of [1, 2]) {
        expect(
          (
            await request(host, 'POST', 'maintenance', {
              ...input,
              equipmentId: equipmentIds[index],
            })
          ).status
        ).toBe(404)
        expect(
          (
            await request(host, 'POST', 'maintenance/preventive-schedule', {
              equipmentId: equipmentIds[index],
              rules: { daysInterval: 30 },
            })
          ).status
        ).toBe(404)
        const id = maintenanceIds[index + 1]
        expect(
          (await request(host, 'PATCH', `maintenance/${id}`, '{')).status
        ).toBe(404)
        expect(
          (await request(host, 'POST', `maintenance/${id}/complete`, '{'))
            .status
        ).toBe(500)
        expect(
          (await request(host, 'POST', `maintenance/${id}/complete`, {})).status
        ).toBe(404)
      }
    expect(
      await prisma.maintenance.count({
        where: { id: { in: maintenanceIds.slice(2) }, status: 'SCHEDULED' },
      })
    ).toBe(2)
  })
  it('PATCH writes exact zero costs/empty fields; cancellation does not release equipment', async () => {
    for (const host of hosts) {
      await reset()
      await prisma.equipment.update({
        where: { id: equipmentIds[0] },
        data: { available: false },
      })
      const r = await request(
        host,
        'PATCH',
        `maintenance/${maintenanceIds[0]}`,
        {
          cost: 0,
          laborCost: 4,
          partsCost: 0,
          notes: '',
          description: '',
          technician: '',
          status: 'CANCELLED',
        }
      )
      expect(r.status).toBe(200)
      expect(r.body.maintenance).toMatchObject({
        cost: '0',
        laborCost: '4',
        partsCost: '0',
        notes: '',
        description: '',
        technician: '',
        status: 'CANCELLED',
      })
      expect(
        (
          await prisma.equipment.findUniqueOrThrow({
            where: { id: equipmentIds[0] },
          })
        ).available
      ).toBe(false)
    }
  })
  it.each(['PENDING', 'ACTIVE', 'OVERDUE', 'PENDING_RETURN'] as const)(
    'rental %s blocks start and leaves state/availability intact',
    async (status) => {
      await prisma.rentals.create({
        data: {
          id: rentalId,
          tenantId,
          userid: context.identity.users[0]!.id,
          startdate: new Date('2026-01-01'),
          enddate: new Date('2027-01-01'),
          total: 10,
          status,
        },
      })
      await prisma.rental_items.create({
        data: {
          id: itemId,
          tenantId,
          rentalid: rentalId,
          equipmentid: equipmentIds[0]!,
          quantity: 1,
          priceperday: 10,
          totaldays: 1,
          totalprice: 10,
        },
      })
      for (const host of hosts) {
        const r = await request(
          host,
          'PATCH',
          `maintenance/${maintenanceIds[0]}`,
          { status: 'IN_PROGRESS' }
        )
        expect(r.status).toBe(400)
        expect(r.body).toEqual({
          error: `Equipamento está locado (Locação ${rentalId})`,
        })
      }
      expect(
        (
          await prisma.maintenance.findUniqueOrThrow({
            where: { id: maintenanceIds[0] },
          })
        ).status
      ).toBe('SCHEDULED')
      expect(
        (
          await prisma.equipment.findUniqueOrThrow({
            where: { id: equipmentIds[0] },
          })
        ).available
      ).toBe(true)
    }
  )
  it('start and completion update availability/meters atomically; zero completion total preserves existing cost', async () => {
    for (const host of hosts) {
      await reset()
      expect(
        (
          await request(host, 'PATCH', `maintenance/${maintenanceIds[0]}`, {
            status: 'IN_PROGRESS',
          })
        ).status
      ).toBe(200)
      expect(
        (
          await prisma.equipment.findUniqueOrThrow({
            where: { id: equipmentIds[0] },
          })
        ).available
      ).toBe(false)
      const r = await request(
        host,
        'POST',
        `maintenance/${maintenanceIds[0]}/complete`,
        {
          cost: 0,
          laborCost: 0,
          partsCost: 0,
          hourMeter: 0,
          odometer: 0,
          notes: '',
          completedAt: '2026-10-02T12:00:00Z',
        }
      )
      expect(r.status).toBe(200)
      expect(r.body.maintenance).toMatchObject({
        status: 'COMPLETED',
        completedAt: '2026-10-02T12:00:00.000Z',
        cost: '12',
        laborCost: '0',
        partsCost: '0',
        notes: '',
      })
      expect(
        await prisma.equipment.findUniqueOrThrow({
          where: { id: equipmentIds[0] },
        })
      ).toMatchObject({
        available: true,
        hourMeter: expect.objectContaining({ toString: expect.any(Function) }),
        odometer: expect.objectContaining({ toString: expect.any(Function) }),
      })
      const equipment = await prisma.equipment.findUniqueOrThrow({
        where: { id: equipmentIds[0] },
      })
      expect(equipment.hourMeter!.toString()).toBe('0')
      expect(equipment.odometer!.toString()).toBe('0')
    }
  })
  it('completion recomputes total and keeps equipment unavailable if another scheduled maintenance exists', async () => {
    for (const host of hosts) {
      await reset()
      await prisma.maintenance.update({
        where: { id: maintenanceIds[1] },
        data: { status: 'SCHEDULED' },
      })
      await prisma.equipment.update({
        where: { id: equipmentIds[0] },
        data: { available: false },
      })
      const r = await request(
        host,
        'POST',
        `maintenance/${maintenanceIds[0]}/complete`,
        { laborCost: 1.25, partsCost: 2.75 }
      )
      expect(r.status).toBe(200)
      expect(r.body.maintenance.cost).toBe('4')
      expect(
        Number.isNaN(new Date(r.body.maintenance.completedAt).getTime())
      ).toBe(false)
      expect(
        (
          await prisma.equipment.findUniqueOrThrow({
            where: { id: equipmentIds[0] },
          })
        ).available
      ).toBe(false)
    }
  })
  it.each([
    {},
    { daysInterval: 0, hoursInterval: 0, rentalsInterval: 0 },
    { hoursInterval: 121 },
  ])('preventive without a reachable date retains 400 %j', async (rules) => {
    for (const host of hosts) {
      const r = await request(host, 'POST', 'maintenance/preventive-schedule', {
        equipmentId: equipmentIds[0],
        rules,
      })
      expect(r.status).toBe(400)
      expect(r.body).toEqual({
        error: 'Não foi possível calcular data de manutenção',
      })
    }
  })
  it('preventive date rules preserve first maintenance, hours and last completion intervals', async () => {
    for (const host of hosts) {
      await reset()
      const first = await request(
        host,
        'POST',
        'maintenance/preventive-schedule',
        {
          equipmentId: equipmentIds[0],
          rules: { daysInterval: 30 },
          description: '',
        }
      )
      expect(first.status).toBe(201)
      expect(first.body.maintenance).toMatchObject({
        type: 'PREVENTIVE',
        status: 'SCHEDULED',
        description: 'Manutenção preventiva agendada automaticamente',
        tenantId,
      })
      expect(
        Math.abs(
          Date.now() - new Date(first.body.maintenance.scheduledAt).getTime()
        )
      ).toBeLessThan(10_000)
      const hours = await request(
        host,
        'POST',
        'maintenance/preventive-schedule',
        { equipmentId: equipmentIds[0], rules: { hoursInterval: 120 } }
      )
      expect(hours.status).toBe(201)
      await prisma.maintenance.update({
        where: { id: maintenanceIds[1] },
        data: {
          type: 'PREVENTIVE',
          completedAt: new Date(Date.now() - 86400000),
        },
      })
      const last = await prisma.maintenance.findUniqueOrThrow({
        where: { id: maintenanceIds[1] },
      })
      const r = await request(host, 'POST', 'maintenance/preventive-schedule', {
        equipmentId: equipmentIds[0],
        rules: { daysInterval: 30 },
      })
      expect(r.status).toBe(201)
      expect(new Date(r.body.maintenance.scheduledAt).getTime()).toBe(
        last.completedAt!.getTime() + 30 * 86400000
      )
    }
  })
  it.each([
    '?page=0',
    '?page=1.5',
    '?limit=101',
    '?limit=no',
    '?startDate=invalid',
    '?endDate=invalid',
  ])('audit validates pagination/dates %s', async (query) => {
    for (const host of hosts) {
      const r = await request(host, 'GET', 'audit-logs' + query)
      expect(r.status).toBe(400)
      expect(r.body).toEqual({ error: 'Filtros inválidos' })
    }
  })
  it('audit row and total are tenant-scoped with identical filters and full legacy projection', async () => {
    const query = `audit-logs?entity=${marker}&userId=${context.identity.users[1]!.id}&entityId=${equipmentIds[0]}&startDate=2026-01-01&endDate=2026-01-02T12:00:00Z&page=2&limit=1`
    // Linha e paginação completas esperadas, montadas da fixture, em cada host (onda 135, B2).
    for (const host of hosts)
      expect(await request(host, 'GET', query)).toEqual({
        status: 200,
        body: {
          logs: [
            {
              id: auditIds[0],
              tenantId,
              userId: context.identity.users[1]!.id,
              action: 'UPDATE',
              entity: marker,
              entityId: equipmentIds[0],
              changes: {
                before: { available: true },
                after: { available: false },
              },
              ipAddress: null,
              userAgent: null,
              createdAt: '2026-01-01T12:00:00.000Z',
              user: {
                id: context.identity.users[1]!.id,
                name: 'fixture-private-customer',
                email: context.identity.users[1]!.email,
              },
            },
          ],
          pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
        },
        cookie: null,
        cache: null,
      })
    for (const host of hosts) {
      const filtered = await request(
        host,
        'GET',
        `audit-logs?entity=${marker}&action=DELETE`
      )
      expect(filtered.body.logs.map((r: { id: string }) => r.id)).toEqual([
        auditIds[1],
      ])
      expect(filtered.body.pagination.total).toBe(1)
    }
  })
  it('preventive rental threshold counts this equipment in the current tenant', async () => {
    await prisma.rentals.create({
      data: {
        id: rentalId,
        tenantId,
        userid: context.identity.users[0]!.id,
        startdate: new Date('2026-01-01'),
        enddate: new Date('2027-01-01'),
        total: 10,
        status: 'COMPLETED',
      },
    })
    await prisma.rental_items.create({
      data: {
        id: itemId,
        tenantId,
        rentalid: rentalId,
        equipmentid: equipmentIds[0]!,
        quantity: 1,
        priceperday: 10,
        totaldays: 1,
        totalprice: 10,
      },
    })
    for (const host of hosts) {
      const tooSoon = await request(
        host,
        'POST',
        'maintenance/preventive-schedule',
        { equipmentId: equipmentIds[0], rules: { rentalsInterval: 2 } }
      )
      expect(tooSoon.status).toBe(400)
      const due = await request(
        host,
        'POST',
        'maintenance/preventive-schedule',
        { equipmentId: equipmentIds[0], rules: { rentalsInterval: 1 } }
      )
      expect(due.status).toBe(201)
      expect(
        Math.abs(
          Date.now() - new Date(due.body.maintenance.scheduledAt).getTime()
        )
      ).toBeLessThan(10_000)
    }
  })
  it('audit defaults are page one/50 and empty matches have zero pages', async () => {
    for (const host of hosts) {
      const r = await request(host, 'GET', `audit-logs?entity=${marker}`)
      expect(r.status).toBe(200)
      expect(r.body.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      })
      const empty = await request(
        host,
        'GET',
        `audit-logs?entity=${marker}-missing`
      )
      expect(empty.body).toEqual({
        logs: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      })
    }
  })
  it('FORCE RLS hides foreign/unassigned maintenance and audit rows and forbids a foreign INSERT', async () => {
    const runtime = new Pool({ connectionString: context.runtimeUrl })
    const client = await runtime.connect()
    try {
      const [{ rolsuper, rolbypassrls }] = (
        await client.query(
          'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user'
        )
      ).rows
      expect(rolsuper).toBe(false)
      expect(rolbypassrls).toBe(false)
      expect(
        (
          await client.query(
            "SELECT relname, relforcerowsecurity FROM pg_class WHERE relname IN ('maintenances','audit_logs')"
          )
        ).rows.every((r) => r.relforcerowsecurity)
      ).toBe(true)
      await client.query('BEGIN')
      expect((await client.query('SELECT id FROM maintenances')).rows).toEqual(
        []
      )
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantId,
      ])
      expect(
        (await client.query('SELECT id FROM maintenances ORDER BY id')).rows
          .map((r) => r.id)
          .sort()
      ).toEqual(maintenanceIds.slice(0, 2).sort())
      expect(
        (
          await client.query('SELECT id FROM audit_logs WHERE entity=$1', [
            marker,
          ])
        ).rows
          .map((r) => r.id)
          .sort()
      ).toEqual(auditIds.slice(0, 2).sort())
      await expect(
        client.query(
          'INSERT INTO maintenances(id,"tenantId","equipmentId",type,"scheduledAt","updatedAt") VALUES($1,$2,$3,\'CORRECTIVE\',now(),now())',
          [randomUUID(), context.bravo.id, equipmentIds[1]]
        )
      ).rejects.toMatchObject({ code: '42501' })
    } finally {
      await client.query('ROLLBACK')
      client.release()
      await runtime.end()
    }
  })
  it('equipment failure rolls back maintenance status, cost and meters in both hosts', async () => {
    const trigger = 'wave51_' + randomUUID().replaceAll('-', '')
    await pool.query(
      `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${equipmentIds[0]}' THEN RAISE EXCEPTION 'local maintenance rollback fixture'; END IF; RETURN NEW; END $$`
    )
    await pool.query(
      `CREATE TRIGGER ${trigger} BEFORE UPDATE ON equipments FOR EACH ROW EXECUTE FUNCTION ${trigger}()`
    )
    try {
      for (const host of hosts) {
        const r = await request(
          host,
          'POST',
          `maintenance/${maintenanceIds[0]}/complete`,
          { cost: 90, hourMeter: 500 }
        )
        expect(r.status).toBe(500)
        expect(r.body).toEqual({ error: 'Internal server error' })
        const row = await prisma.maintenance.findUniqueOrThrow({
          where: { id: maintenanceIds[0] },
        })
        expect(row.status).toBe('SCHEDULED')
        expect(row.cost!.toString()).toBe('12')
        expect(row.completedAt).toBeNull()
        expect(
          (
            await prisma.equipment.findUniqueOrThrow({
              where: { id: equipmentIds[0] },
            })
          ).hourMeter!.toString()
        ).toBe('120')
      }
    } finally {
      await pool.query(`DROP TRIGGER ${trigger} ON equipments`)
      await pool.query(`DROP FUNCTION ${trigger}()`)
    }
  })
})
