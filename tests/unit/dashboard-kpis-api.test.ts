import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import Decimal from 'decimal.js'

const state = vi.hoisted(() => {
  const model = () => ({
    count: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
  })
  return {
    permission: vi.fn(),
    transaction: vi.fn(),
    tx: {
      equipment: model(),
      category: model(),
      quote: model(),
      payment: model(),
      maintenance: model(),
      rentals: model(),
      rental_items: model(),
    },
  }
})
vi.mock('@/lib/tenant', () => ({ withTenantTransaction: state.transaction }))
vi.mock('@/lib/tenant-permissions', () => ({
  requireTenantPermission: state.permission,
}))
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('../../apps/services/api/src/host/tenant-transaction', () => ({
  withTenantTransaction: state.transaction,
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
import * as legacyRoute0 from '@/app/api/admin/dashboard/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/dashboard/route'
import * as legacyRoute1 from '@/app/api/admin/kpis/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/kpis/route'
import * as legacyRoute2 from '@/app/api/admin/analytics/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/analytics/route'
import * as legacyRoute3 from '@/app/api/admin/security/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/security/route'

const HOSTS = [
  [
    'legacy root',
    {
      dashboard: legacyRoute0.GET,
      kpis: legacyRoute1.GET,
      analytics: legacyRoute2.GET,
      security: legacyRoute3.GET,
    },
  ],
  [
    'service',
    {
      dashboard: serviceRoute0.GET,
      kpis: serviceRoute1.GET,
      analytics: serviceRoute2.GET,
      security: serviceRoute3.GET,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (_host, { dashboard, kpis, analytics, security }) => {
    const principal = {
      tenantId: 'tenant-a',
      userId: 'user-a',
      membershipId: 'member-a',
      role: 'ADMIN',
    }
    const req = (query = '') =>
      new NextRequest('https://api.test/api/admin/kpis' + query)
    const equipment = {
      id: 'equipment-a',
      name: 'Local',
      purchasePrice: new Decimal(200),
      rental_items: [{ rentals: { payments: [{ amount: new Decimal(80) }] } }],
      maintenances: [{ cost: new Decimal(20) }, { cost: null }],
    }
    const endpoints = [
      ['dashboard', dashboard],
      ['kpis', kpis],
    ] as const
    beforeEach(() => {
      vi.resetAllMocks()
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-02T12:00:00Z'))
      vi.spyOn(console, 'error').mockImplementation(() => {})
      state.permission.mockResolvedValue({ ok: true, principal })
      state.transaction.mockImplementation(async (_scope, operation) =>
        operation(state.tx)
      )
      state.tx.equipment.count.mockResolvedValue(4)
      state.tx.category.count.mockResolvedValue(2)
      state.tx.quote.count.mockImplementation(
        async ({ where }) =>
          ({ PENDING: 2, APPROVED: 3, REJECTED: 4, COMPLETED: 5 })[
            where.status as 'PENDING'
          ] ?? 14
      )
      state.tx.quote.aggregate.mockResolvedValue({
        _sum: { total: new Decimal(100) },
      })
      state.tx.equipment.aggregate.mockResolvedValue({ _sum: { maxStock: 10 } })
      state.tx.equipment.findMany.mockResolvedValue([equipment])
      state.tx.rental_items.findMany.mockResolvedValue([
        { quantity: 2 },
        { quantity: 3 },
      ])
      state.tx.payment.findMany.mockResolvedValue([
        { amount: new Decimal(80) },
        { amount: new Decimal(20) },
      ])
      state.tx.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal(120) },
      })
      state.tx.payment.count.mockImplementation(async ({ where }) =>
        where.type === 'RENTAL' ? (where.status === 'OVERDUE' ? 1 : 4) : 2
      )
      state.tx.maintenance.aggregate.mockResolvedValue({
        _sum: {
          cost: new Decimal(20),
          laborCost: new Decimal(3),
          partsCost: new Decimal(7),
        },
      })
      state.tx.rentals.findMany.mockResolvedValue([
        {
          startdate: new Date('2026-01-01T00:00:00Z'),
          enddate: new Date('2026-01-03T01:00:00Z'),
        },
        { startdate: new Date('2026-01-01'), enddate: new Date('2026-01-02') },
      ])
    })
    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })
    describe('dashboard and KPI characterization before extraction', () => {
      it.each(endpoints)(
        '%s preserves refusal and required FINANCIAL/READ before SQL',
        async (_name, handler) => {
          for (const code of [401, 403, 409]) {
            const refusal = Response.json({ error: 'Denied' }, { status: code })
            state.permission.mockResolvedValue({ ok: false, response: refusal })
            expect(await handler(req())).toBe(refusal)
          }
          expect(state.permission).toHaveBeenCalledWith(
            expect.any(Request),
            'FINANCIAL',
            'READ'
          )
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
      it.each(endpoints)(
        '%s executes in the authorized tenant transaction',
        async (_name, handler) => {
          expect((await handler(req())).status).toBe(200)
          expect(state.transaction.mock.calls[0]![0]).toEqual(principal)
          for (const model of Object.values(state.tx))
            for (const method of Object.values(model))
              for (const [args] of method.mock.calls)
                expect(
                  args.where.tenantId ?? args.where.AND?.[0]?.tenantId
                ).toBe('tenant-a')
        }
      )
      it('preserves exact KPI DTO and legacy revenue/maintenance arithmetic', async () => {
        expect(await (await kpis(req())).json()).toEqual({
          kpis: {
            fleetUtilizationRate: 50,
            averageRevenuePerEquipment: 25,
            equipmentROI: [
              {
                equipmentId: 'equipment-a',
                equipmentName: 'Local',
                purchasePrice: 200,
                totalRevenue: 80,
                totalMaintenanceCost: 20,
                roi: 30,
              },
            ],
            averageRentalDuration: 2,
            defaultRate: 25,
            maintenanceCostPerEquipment: [
              {
                equipmentId: 'equipment-a',
                equipmentName: 'Local',
                totalCost: 20,
                maintenanceCount: 2,
              },
            ],
          },
        })
        expect(state.tx.payment.findMany.mock.calls[0]![0].where).toMatchObject(
          {
            tenantId: 'tenant-a',
            status: 'PAID',
            type: 'RENTAL',
            paidAt: { gte: new Date(2026, 0, 1), lte: new Date() },
          }
        )
        expect(
          state.tx.rental_items.findMany.mock.calls[0]![0].where.rentals.status
            .in
        ).toEqual(['ACTIVE', 'OVERDUE', 'PENDING_RETURN'])
      })
      it('keeps dashboard field types, financial scope, current month and seven sparklines', async () => {
        const body = await (
          await dashboard(req('?startDate=2000-01-01'))
        ).json()
        expect(body).toMatchObject({
          totalEquipments: 4,
          availableEquipments: 4,
          totalCategories: 2,
          totalQuotes: 14,
          pendingQuotes: 2,
          approvedQuotes: 3,
          rejectedQuotes: 4,
          completedQuotes: 5,
          totalRevenue: '100',
          monthlyRevenue: 120,
          utilizationRate: 50,
          averageRevenuePerEquipment: 25,
          financialMetrics: {
            metrics: {
              mrr: 120,
              fleetUtilization: 50,
              overdueAmount: 120,
              averageTicket: 60,
              netProfit: 90,
            },
            trends: {
              mrr: 0,
              fleetUtilization: 0,
              overdueAmount: 0,
              averageTicket: 0,
              netProfit: 0,
            },
          },
        })
        expect(Object.keys(body.financialMetrics.sparklines)).toEqual([
          'mrr',
          'fleetUtilization',
          'overdueAmount',
          'averageTicket',
          'netProfit',
        ])
        expect(body.financialMetrics.sparklines.mrr).toEqual(Array(7).fill(120))
        expect(body.financialMetrics.sparklines.netProfit).toEqual(
          Array(7).fill(90)
        )
        expect(state.tx.payment.aggregate.mock.calls[0]![0].where).toEqual({
          tenantId: 'tenant-a',
          method: 'BOLETO',
          type: { in: ['RENTAL', 'DEPOSIT'] },
          AND: [
            { OR: [{ quoteId: { not: null } }, { rentalId: { not: null } }] },
            { paidAt: { gte: new Date(2026, 9, 1) } },
            { billingStatus: 'PAID' },
          ],
        })
      })
      it('dashboard retains first ten ROI rows without adding a sort', async () => {
        state.tx.equipment.findMany.mockResolvedValue(
          Array.from({ length: 12 }, (_, i) => ({
            ...equipment,
            id: 'eq-' + i,
            purchasePrice: 200 - i,
          }))
        )
        const body = await (await dashboard(req())).json()
        expect(
          body.equipmentROI.map((r: { equipmentId: string }) => r.equipmentId)
        ).toEqual(Array.from({ length: 10 }, (_, i) => 'eq-' + i))
        expect(
          state.tx.equipment.findMany.mock.calls[0]![0]
        ).not.toHaveProperty('orderBy')
      })
      it.each([
        '?startDate=2026-01-01&endDate=2026-02-01',
        '?startDate=2026-01-01',
        '?endDate=2026-02-01',
        '?startDate=&endDate=',
        '?startDate=2027-01-01&endDate=2020-01-01',
        '?startDate=2026-01-01&startDate=2025-01-01',
      ])('preserves date/default semantics %s', async (query) => {
        expect((await kpis(req(query))).status).toBe(200)
        const params = new URL('https://api.test' + query).searchParams,
          filter =
            state.tx.rental_items.findMany.mock.calls[0]![0].where.rentals.OR[0]
              .AND
        expect(filter[0].startdate.lte).toEqual(
          params.get('endDate') ? new Date(params.get('endDate')!) : new Date()
        )
        expect(filter[1].enddate.gte).toEqual(
          params.get('startDate')
            ? new Date(params.get('startDate')!)
            : new Date()
        )
      })
      it('forwards invalid dates to Prisma and preserves resulting generic 500', async () => {
        state.tx.rental_items.findMany.mockImplementation(async ({ where }) => {
          expect(
            Number.isNaN(where.rentals.OR[0].AND[1].enddate.gte.getTime())
          ).toBe(true)
          throw new Error('Invalid Date')
        })
        const response = await kpis(req('?startDate=invalid'))
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Internal server error',
        })
      })
      it('preserves empty and null totals without NaN', async () => {
        state.tx.equipment.count.mockResolvedValue(0)
        state.tx.equipment.aggregate.mockResolvedValue({
          _sum: { maxStock: null },
        })
        state.tx.equipment.findMany.mockResolvedValue([])
        state.tx.payment.findMany.mockResolvedValue([])
        state.tx.payment.count.mockResolvedValue(0)
        state.tx.payment.aggregate.mockResolvedValue({ _sum: { amount: null } })
        state.tx.quote.aggregate.mockResolvedValue({ _sum: { total: null } })
        state.tx.maintenance.aggregate.mockResolvedValue({
          _sum: { cost: null, laborCost: null, partsCost: null },
        })
        state.tx.rentals.findMany.mockResolvedValue([])
        expect(await (await kpis(req())).json()).toEqual({
          kpis: {
            fleetUtilizationRate: 0,
            averageRevenuePerEquipment: 0,
            equipmentROI: [],
            averageRentalDuration: 0,
            defaultRate: 0,
            maintenanceCostPerEquipment: [],
          },
        })
        const body = await (await dashboard(req())).json()
        expect(body.totalRevenue).toBe(0)
        expect(body.financialMetrics.metrics).toEqual({
          mrr: 0,
          fleetUtilization: 0,
          overdueAmount: 0,
          averageTicket: 0,
          netProfit: 0,
        })
      })
      it('preserves ROI attribution and zero purchase-price fallback', async () => {
        state.tx.equipment.findMany.mockResolvedValue([
          {
            ...equipment,
            purchasePrice: null,
            rental_items: [
              equipment.rental_items[0],
              equipment.rental_items[0],
            ],
          },
        ])
        const body = await (await kpis(req())).json()
        expect(body.kpis.equipmentROI[0]).toMatchObject({
          purchasePrice: 0,
          totalRevenue: 160,
          roi: 0,
        })
      })
      it.each(endpoints)(
        '%s sanitizes unexpected permission/transaction/model failures',
        async (_name, handler) => {
          for (const boundary of ['permission', 'transaction', 'model']) {
            const fault = new Error('private SQL password')
            state.permission.mockResolvedValue({ ok: true, principal })
            state.transaction.mockImplementation(async (_scope, operation) =>
              operation(state.tx)
            )
            state.tx.equipment.count.mockResolvedValue(4)
            if (boundary === 'permission')
              state.permission.mockRejectedValue(fault)
            if (boundary === 'transaction')
              state.transaction.mockRejectedValue(fault)
            if (boundary === 'model') {
              state.tx.equipment.count.mockRejectedValue(fault)
              state.tx.equipment.aggregate.mockRejectedValue(fault)
            }
            const response = await handler(req())
            expect(response.status).toBe(500)
            expect(await response.json()).toEqual({
              error: 'Internal server error',
            })
          }
        }
      )
      it.each([
        ['analytics', analytics],
        ['security', security],
      ] as const)(
        '%s stays retired without auth, SQL or query processing',
        async (_name, handler) => {
          state.permission.mockRejectedValue(
            new Error('must not read identity')
          )
          const response = handler()
          expect(response.status).toBe(410)
          expect(await response.json()).toEqual({ error: 'Endpoint retired' })
          expect(state.permission).not.toHaveBeenCalled()
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
    })
  }
)
