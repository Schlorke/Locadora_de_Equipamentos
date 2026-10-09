import { withTestPlatformTransaction } from '../helpers/platform-fixture'
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
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const tenants = [randomUUID(), randomUUID(), randomUUID()]
const member = randomUUID(),
  clientMember = randomUUID(),
  permission = randomUUID()
const equipmentIds = Array.from({ length: 13 }, () => randomUUID())
const rentalIds = Array.from({ length: 4 }, () => randomUUID())
const quoteIds = Array.from({ length: 5 }, () => randomUUID())
const paymentIds = Array.from({ length: 9 }, () => randomUUID())
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[60]!,
}
const now = new Date(),
  month = new Date(now.getFullYear(), now.getMonth(), 1)
const future = new Date(now.getFullYear(), now.getMonth() + 1, 1)
const past = new Date(now.getTime() - 40 * 86400000)
let cookie = '',
  clientCookie = ''
async function request(
  host: string,
  name: string,
  query = '',
  headers: Record<string, string> = {}
) {
  const response = await fetch(`${host}/api/admin/${name}${query}`, {
    headers: {
      ...edge,
      Cookie: cookie,
      'x-tenant-id': tenants[0]!,
      ...headers,
    },
  })
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get('set-cookie'),
  }
}
async function counts() {
  const where = { tenantId: { in: tenants } }
  return Promise.all([
    prisma.payment.count({ where }),
    prisma.quote.count({ where }),
    prisma.rentals.count({ where }),
    prisma.rental_items.count({ where }),
    prisma.maintenance.count({ where }),
    prisma.equipment.count({ where }),
    prisma.auditLog.count({ where }),
    prisma.outboxEvent.count({ where }),
  ])
}
beforeAll(async () => {
  cookie = await signInParityUser(context, edge, 1)
  clientCookie = await signInParityUser(context, edge, 0)
  for (const [index, id] of tenants.entries())
    await prisma.organization.create({
      data: { id, slug: id, name: 'Dashboard parity ' + index },
    })
  await prisma.membership.createMany({
    data: [
      {
        id: member,
        tenantId: tenants[0]!,
        userId: context.identity.users[1]!.id,
        role: 'ADMIN',
      },
      {
        id: clientMember,
        tenantId: tenants[0]!,
        userId: context.identity.users[0]!.id,
        role: 'CLIENT',
      },
      {
        tenantId: tenants[2]!,
        userId: context.identity.users[1]!.id,
        role: 'ADMIN',
      },
    ],
  })
  for (const index of [0, 1]) {
    const category = await prisma.category.create({
      data: {
        tenantId: tenants[index],
        name: 'Dashboard ' + index,
        slug: 'dashboard-' + tenants[index],
        iconColor: '#ea580c',
        bgColor: '#fff7ed',
        fontColor: '#7c2d12',
      },
    })
    for (const id of index === 0
      ? equipmentIds.slice(0, 12)
      : equipmentIds.slice(12))
      await prisma.equipment.create({
        data: {
          id,
          tenantId: tenants[index],
          categoryId: category.id,
          name: 'Dashboard ' + id,
          pricePerDay: 5,
          images: [],
          maxStock: id === equipmentIds[0] ? 10 : 0,
          purchasePrice: id === equipmentIds[0] ? 200 : null,
          available: id !== equipmentIds[1],
        },
      })
  }
  for (const [index, status] of (
    ['COMPLETED', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'] as const
  ).entries())
    await prisma.quote.create({
      data: {
        id: quoteIds[index],
        tenantId: tenants[index === 4 ? 1 : 0],
        name: 'Dashboard',
        email: 'dashboard@example.test',
        phone: '',
        status,
        total: index === 4 ? 999999 : index === 0 ? 100 : 0,
      },
    })
  for (const [index, status] of (
    ['ACTIVE', 'COMPLETED', 'COMPLETED', 'ACTIVE'] as const
  ).entries())
    await prisma.rentals.create({
      data: {
        id: rentalIds[index]!,
        tenantId: tenants[index === 3 ? 1 : 0],
        userid: context.identity.users[0]!.id,
        status,
        total: 100,
        startdate:
          index === 0 || index === 3
            ? new Date(now.getTime() - 10 * 86400000)
            : new Date('2020-01-01'),
        enddate:
          index === 0 || index === 3
            ? new Date(now.getTime() + 10 * 86400000)
            : new Date(index === 1 ? '2020-01-03' : '2020-01-05'),
      },
    })
  await prisma.rental_items.createMany({
    data: [
      {
        id: randomUUID(),
        tenantId: tenants[0],
        rentalid: rentalIds[0]!,
        equipmentid: equipmentIds[0]!,
        quantity: 3,
        priceperday: 5,
        totaldays: 20,
        totalprice: 100,
      },
      {
        id: randomUUID(),
        tenantId: tenants[0],
        rentalid: rentalIds[0]!,
        equipmentid: equipmentIds[1]!,
        quantity: 2,
        priceperday: 5,
        totaldays: 20,
        totalprice: 100,
      },
      {
        id: randomUUID(),
        tenantId: tenants[1],
        rentalid: rentalIds[3]!,
        equipmentid: equipmentIds[12]!,
        quantity: 999,
        priceperday: 5,
        totaldays: 20,
        totalprice: 100,
      },
    ],
  })
  const charges = [
    {
      amount: 80,
      method: 'BOLETO',
      status: 'PAID',
      billingStatus: 'PAID',
      type: 'RENTAL',
    },
    {
      amount: 20,
      method: 'PIX',
      status: 'PAID',
      billingStatus: 'PAID',
      type: 'RENTAL',
    },
    {
      amount: 30,
      method: 'BOLETO',
      status: 'PENDING',
      billingStatus: 'PAID',
      type: 'DEPOSIT',
    },
    {
      amount: 40,
      method: 'BOLETO',
      status: 'PAID',
      billingStatus: 'AWAITING_PAYMENT',
      type: 'RENTAL',
    },
    {
      amount: 50,
      method: 'BOLETO',
      status: 'OVERDUE',
      billingStatus: 'UNPAID',
      type: 'RENTAL',
    },
    {
      amount: 900,
      method: 'BOLETO',
      status: 'PAID',
      billingStatus: 'PAID',
      type: 'FINE',
    },
    {
      amount: 70,
      method: 'BOLETO',
      status: 'PENDING',
      billingStatus: 'PAID',
      type: 'RENTAL',
    },
    {
      amount: 999999,
      method: 'BOLETO',
      status: 'PAID',
      billingStatus: 'PAID',
      type: 'RENTAL',
    },
    {
      amount: 888888,
      method: 'BOLETO',
      status: 'PAID',
      billingStatus: 'PAID',
      type: 'RENTAL',
    },
  ] as const
  for (const [index, charge] of charges.entries())
    await prisma.payment.create({
      data: {
        ...charge,
        id: paymentIds[index],
        tenantId: index === 8 ? null : tenants[index === 7 ? 1 : 0],
        rentalId: index === 8 ? null : rentalIds[index === 7 ? 3 : 0],
        paidAt: index === 6 ? future : month,
        dueDate: past,
      },
    })
  await prisma.maintenance.createMany({
    data: [
      {
        tenantId: tenants[0],
        equipmentId: equipmentIds[0]!,
        type: 'CORRECTIVE',
        status: 'COMPLETED',
        scheduledAt: month,
        completedAt: month,
        cost: 20,
        laborCost: 3,
        partsCost: 7,
      },
      {
        tenantId: tenants[0],
        equipmentId: equipmentIds[0]!,
        type: 'CORRECTIVE',
        status: 'COMPLETED',
        scheduledAt: month,
        completedAt: month,
        cost: null,
      },
      {
        tenantId: tenants[1],
        equipmentId: equipmentIds[12]!,
        type: 'CORRECTIVE',
        status: 'COMPLETED',
        scheduledAt: month,
        completedAt: month,
        cost: 999999,
      },
    ],
  })
})
beforeEach(async () => {
  await prisma.permission.deleteMany({ where: { id: permission } })
  await prisma.membership.update({
    where: { id: member },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
  await withTestPlatformTransaction(prisma, async (tx) =>
    tx.organization.update({
      where: { id: tenants[0] },
      data: { status: 'ACTIVE' },
    })
  )
})
afterAll(async () => {
  try {
    const where = { tenantId: { in: tenants } }
    await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } })
    await prisma.maintenance.deleteMany({ where })
    await prisma.rental_items.deleteMany({ where })
    await prisma.rentals.deleteMany({ where })
    await prisma.quote.deleteMany({ where })
    await prisma.equipment.deleteMany({ where })
    await prisma.category.deleteMany({ where })
    await prisma.permission.deleteMany({ where })
    await prisma.membership.deleteMany({ where })
    await prisma.organization.deleteMany({ where: { id: { in: tenants } } })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})
/** Corpos completos esperados do painel e dos KPIs, montados da fixture deste arquivo (onda 135, B2). */
const expectedReply = {
  dashboard(): unknown {
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(now)
      day.setDate(day.getDate() - 6 + index)
      return day.toDateString() === month.toDateString()
    })
    return {
      totalEquipments: 12,
      availableEquipments: 11,
      totalCategories: 1,
      totalQuotes: 4,
      pendingQuotes: 1,
      approvedQuotes: 1,
      rejectedQuotes: 1,
      completedQuotes: 1,
      totalRevenue: '100',
      monthlyRevenue: 180,
      utilizationRate: 50,
      equipmentROI: expectedRoi().slice(0, 10),
      averageRevenuePerEquipment: 140 / 12,
      financialMetrics: {
        metrics: {
          mrr: 110,
          fleetUtilization: 50,
          overdueAmount: 90,
          averageTicket: 55,
          netProfit: 80,
        },
        trends: {
          mrr: 0,
          fleetUtilization: 0,
          overdueAmount: 0,
          averageTicket: 0,
          netProfit: 0,
        },
        sparklines: {
          mrr: days.map((paid) => (paid ? 110 : 0)),
          fleetUtilization: [50, 50, 50, 50, 50, 50, 50],
          overdueAmount: [90, 90, 90, 90, 90, 90, 90],
          averageTicket: days.map((paid) => (paid ? 55 : 0)),
          netProfit: days.map((paid) => (paid ? 80 : 0)),
        },
      },
    }
  },
  kpis(): unknown {
    return {
      kpis: {
        fleetUtilizationRate: 50,
        averageRevenuePerEquipment: 140 / 12,
        equipmentROI: expectedRoi(),
        averageRentalDuration: 3,
        defaultRate: 20,
        maintenanceCostPerEquipment: equipmentIds
          .slice(0, 12)
          .map((id, index) => ({
            equipmentId: id,
            equipmentName: 'Dashboard ' + id,
            totalCost: index === 0 ? 20 : 0,
            maintenanceCount: index === 0 ? 2 : 0,
          })),
      },
    }
  },
  headers(name: string): unknown {
    if (!['dashboard', 'kpis', 'analytics', 'security'].includes(name))
      throw new Error('Endpoint não especificado: ' + name)
    return { type: 'application/json', cache: null }
  },
}
function expectedRoi() {
  return equipmentIds.slice(0, 12).map((id, index) => ({
    equipmentId: id,
    equipmentName: 'Dashboard ' + id,
    purchasePrice: index === 0 ? 200 : 0,
    totalRevenue: index < 2 ? 140 : 0,
    totalMaintenanceCost: index === 0 ? 20 : 0,
    roi: index === 0 ? 60 : 0,
  }))
}
describe('dashboard, KPI and retired contracts over both production hosts', () => {
  it.each(['dashboard', 'kpis'])(
    '%s preserves anonymous, explicit selection, revoked, suspended and foreign-company refusal',
    async (name) => {
      for (const host of hosts) {
        expect((await request(host, name, '', { Cookie: '' })).status).toBe(401)
        expect(
          (await request(host, name, '', { 'x-tenant-id': '' })).status
        ).toBe(409)
        expect(
          (await request(host, name, '', { 'x-tenant-id': tenants[1]! })).status
        ).toBe(403)
      }
      await prisma.membership.update({
        where: { id: member },
        data: { status: 'REVOKED' },
      })
      for (const host of hosts)
        expect((await request(host, name)).status).toBe(403)
      await prisma.membership.update({
        where: { id: member },
        data: { status: 'ACTIVE' },
      })
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: tenants[0] },
          data: { status: 'SUSPENDED' },
        })
      )
      for (const host of hosts)
        expect((await request(host, name)).status).toBe(403)
    }
  )
  it.each(['dashboard', 'kpis'])(
    '%s revalidates exact FINANCIAL/READ and always rejects CLIENT',
    async (name) => {
      await prisma.membership.update({
        where: { id: member },
        data: { role: 'OPERATOR' },
      })
      for (const host of hosts)
        expect((await request(host, name)).status).toBe(403)
      await prisma.permission.create({
        data: {
          id: permission,
          tenantId: tenants[0]!,
          role: 'OPERATOR',
          module: 'FINANCIAL',
          action: 'WRITE',
        },
      })
      for (const host of hosts)
        expect((await request(host, name)).status).toBe(403)
      await prisma.permission.update({
        where: { id: permission },
        data: { action: 'READ' },
      })
      for (const host of hosts)
        expect((await request(host, name)).status).toBe(200)
      await prisma.permission.update({
        where: { id: permission },
        data: { role: 'CLIENT' },
      })
      for (const host of hosts)
        expect(
          (await request(host, name, '', { Cookie: clientCookie })).status
        ).toBe(403)
    }
  )
  it('keeps independent provider/billing states, monthly upper-bound asymmetry, maintenance costs, DTO types and tenant isolation', async () => {
    const before = await counts()
    for (const host of hosts) {
      const r = await request(
        host,
        'dashboard',
        '?startDate=invalid&endDate=invalid'
      )
      expect(r.status).toBe(200)
      expect(r.body).toMatchObject({
        totalEquipments: 12,
        availableEquipments: 11,
        totalCategories: 1,
        totalQuotes: 4,
        pendingQuotes: 1,
        approvedQuotes: 1,
        rejectedQuotes: 1,
        completedQuotes: 1,
        totalRevenue: '100',
        monthlyRevenue: 180,
        utilizationRate: 50,
        averageRevenuePerEquipment: 140 / 12,
        financialMetrics: {
          metrics: {
            mrr: 110,
            fleetUtilization: 50,
            overdueAmount: 90,
            averageTicket: 55,
            netProfit: 80,
          },
        },
      })
      expect(r.body.equipmentROI).toHaveLength(10)
      expect(
        r.body.equipmentROI.find(
          (e: { equipmentId: string }) => e.equipmentId === equipmentIds[0]
        )
      ).toMatchObject({ totalRevenue: 140, totalMaintenanceCost: 20, roi: 60 })
      expect(
        r.body.equipmentROI.map((e: { equipmentId: string }) => e.equipmentId)
      ).not.toContain(equipmentIds[12])
      for (const points of Object.values(r.body.financialMetrics.sparklines))
        expect(points).toHaveLength(7)
      expect(r.body).toEqual(expectedReply.dashboard())
    }
    expect(await counts()).toEqual(before)
  })
  it('preserves KPI full arrays, default period, whole-rental ROI allocation and all-time statistics', async () => {
    const before = await counts()
    for (const host of hosts) {
      const r = await request(host, 'kpis')
      expect(r.status).toBe(200)
      expect(r.body.kpis).toMatchObject({
        fleetUtilizationRate: 50,
        averageRevenuePerEquipment: 140 / 12,
        averageRentalDuration: 3,
        defaultRate: 20,
      })
      expect(r.body.kpis.equipmentROI).toHaveLength(12)
      expect(
        r.body.kpis.equipmentROI.find(
          (e: { equipmentId: string }) => e.equipmentId === equipmentIds[1]
        )
      ).toMatchObject({ purchasePrice: 0, totalRevenue: 140, roi: 0 })
      expect(
        r.body.kpis.maintenanceCostPerEquipment.find(
          (e: { equipmentId: string }) => e.equipmentId === equipmentIds[0]
        )
      ).toMatchObject({ totalCost: 20, maintenanceCount: 2 })
      expect(r.body).toEqual(expectedReply.kpis())
    }
    expect(await counts()).toEqual(before)
  })
  it.each([
    '?startDate=2000-01-01&endDate=2000-01-02',
    '?startDate=2027-01-01&endDate=2000-01-01',
    '?startDate=2000-01-01&startDate=invalid&endDate=2000-01-02',
  ])(
    'preserves date filters and first duplicate parameter %s',
    async (query) => {
      for (const host of hosts) {
        const r = await request(host, 'kpis', query)
        expect(r.status).toBe(200)
        expect(r.body.kpis).toMatchObject({
          fleetUtilizationRate: 0,
          averageRevenuePerEquipment: 0,
          averageRentalDuration: 3,
          defaultRate: 20,
        })
        expect(
          r.body.kpis.equipmentROI.find(
            (e: { equipmentId: string }) => e.equipmentId === equipmentIds[0]
          ).totalRevenue
        ).toBe(140)
      }
    }
  )
  it.each(['?startDate=invalid', '?endDate=invalid'])(
    'preserves actual Prisma invalid-Date generic 500 %s',
    async (query) => {
      for (const host of hosts)
        expect(await request(host, 'kpis', query)).toMatchObject({
          status: 500,
          body: { error: 'Internal server error' },
        })
    }
  )
  it.each(['dashboard', 'kpis'])(
    '%s keeps empty-company zero totals',
    async (name) => {
      for (const host of hosts) {
        const r = await request(host, name, '', { 'x-tenant-id': tenants[2]! })
        expect(r.status).toBe(200)
        if (name === 'kpis')
          expect(r.body).toEqual({
            kpis: {
              fleetUtilizationRate: 0,
              averageRevenuePerEquipment: 0,
              equipmentROI: [],
              averageRentalDuration: 0,
              defaultRate: 0,
              maintenanceCostPerEquipment: [],
            },
          })
        else {
          expect(r.body.totalRevenue).toBe(0)
          expect(r.body.monthlyRevenue).toBe(0)
          expect(r.body.financialMetrics.metrics).toEqual({
            mrr: 0,
            fleetUtilization: 0,
            overdueAmount: 0,
            averageTicket: 0,
            netProfit: 0,
          })
        }
      }
    }
  )
  it.each(['analytics', 'security'])(
    '%s stays inert 410 with or without session, company and malformed query',
    async (name) => {
      const before = await counts()
      for (const host of hosts)
        for (const headers of [
          { Cookie: '', 'x-tenant-id': '' },
          { Cookie: clientCookie, 'x-tenant-id': tenants[0]! },
          { Cookie: cookie, 'x-tenant-id': tenants[1]! },
        ])
          expect(
            await request(host, name, '?startDate=invalid', headers)
          ).toEqual({
            status: 410,
            body: { error: 'Endpoint retired' },
            cookie: null,
          })
      expect(await counts()).toEqual(before)
    }
  )
  it('proves FORCE RLS and lack of BYPASSRLS on the production fixture role', async () => {
    const runtimePool = new Pool({ connectionString: context.runtimeUrl })
    try {
      const identity = await runtimePool.query(
        'SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user'
      )
      expect(identity.rows[0]).toMatchObject({
        rolsuper: false,
        rolbypassrls: false,
      })
      const client = await runtimePool.connect()
      try {
        await client.query('BEGIN')
        await client.query("SELECT set_config('app.tenant_id',$1,true)", [
          tenants[0],
        ])
        expect(
          Number(
            (await client.query('SELECT count(*) FROM equipments')).rows[0]
              .count
          )
        ).toBe(12)
        expect(
          (
            await client.query('SELECT id FROM equipments WHERE id=$1', [
              equipmentIds[12],
            ])
          ).rows
        ).toEqual([])
        expect(
          (
            await client.query('SELECT id FROM equipments WHERE id=$1', [
              context.unassignedEquipment,
            ])
          ).rows
        ).toEqual([])
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
      const policies = await pool.query(
        'SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1)',
        [
          [
            'equipments',
            'payments',
            'rentals',
            'rental_items',
            'maintenances',
            'quotes',
            'categories',
          ],
        ]
      )
      expect(policies.rows).toHaveLength(7)
      for (const row of policies.rows)
        expect(row).toMatchObject({
          relrowsecurity: true,
          relforcerowsecurity: true,
        })
    } finally {
      await runtimePool.end()
    }
  })
  it('keeps response content-type/cache headers and creates no session cookie', async () => {
    for (const name of ['dashboard', 'kpis', 'analytics', 'security']) {
      for (const host of hosts) {
        const response = await fetch(`${host}/api/admin/${name}`, {
          headers: { ...edge, Cookie: cookie, 'x-tenant-id': tenants[0]! },
        })
        expect({
          type: response.headers.get('content-type'),
          cache: response.headers.get('cache-control'),
        }).toEqual(expectedReply.headers(name))
        expect(response.headers.get('set-cookie')).toBeNull()
        await response.arrayBuffer()
      }
    }
  })
  it('sanitizes actual SQL permission failures and keeps retired replies independent of SQL', async () => {
    const runtimePool = new Pool({ connectionString: context.runtimeUrl })
    try {
      const role = (await runtimePool.query('SELECT current_user AS role'))
        .rows[0].role
      if (!/^api_parity_[a-z0-9_]+$/i.test(role))
        throw new Error('Unexpected fixture role')
      await alterSharedAcl(pool, `REVOKE SELECT ON equipments FROM "${role}"`)
      try {
        for (const host of hosts) {
          for (const name of ['dashboard', 'kpis'])
            expect(await request(host, name)).toMatchObject({
              status: 500,
              body: { error: 'Internal server error' },
            })
          for (const name of ['analytics', 'security'])
            expect(await request(host, name)).toMatchObject({
              status: 410,
              body: { error: 'Endpoint retired' },
            })
        }
      } finally {
        await alterSharedAcl(pool, `GRANT SELECT ON equipments TO "${role}"`)
      }
    } finally {
      await runtimePool.end()
    }
  })
})
