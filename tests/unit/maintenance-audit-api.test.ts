import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Decimal from 'decimal.js'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'

const state = vi.hoisted(() => {
  const model = () => ({
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  })
  return {
    principal: vi.fn(),
    transaction: vi.fn(),
    tx: {
      organization: model(),
      $executeRaw: vi.fn(),
      maintenance: model(),
      equipment: model(),
      rental_items: model(),
      auditLog: model(),
    },
  }
})
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('../../apps/services/api/src/host/tenant-transaction', () => ({
  withTenantTransaction: state.transaction,
}))
import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/maintenance/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/maintenance/scheduled/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/maintenance/preventive-schedule/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/maintenance/[id]/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/maintenance/[id]/complete/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/admin/audit-logs/route'

const HOSTS = [
  [
    'service',
    {
      list: serviceRoute0.GET,
      create: serviceRoute0.POST,
      scheduled: serviceRoute1.GET,
      preventive: serviceRoute2.POST,
      update: serviceRoute3.PATCH,
      complete: serviceRoute4.POST,
      audit: serviceRoute5.GET,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (_host, { list, create, scheduled, preventive, update, complete, audit }) => {
    const principal = {
      tenantId: 'tenant-a',
      userId: 'user-a',
      membershipId: 'member-a',
      role: 'ADMIN',
    }
    const params = { params: Promise.resolve({ id: 'maintenance-a' }) }
    const input = {
      equipmentId: 'equipment-a',
      type: 'CORRECTIVE',
      scheduledAt: '2026-12-01T10:00:00Z',
    }
    const row = {
      id: 'maintenance-a',
      equipmentId: 'equipment-a',
      tenantId: 'tenant-a',
      equipment: { id: 'equipment-a', name: 'Local' },
      cost: new Decimal(12),
      scheduledAt: new Date(input.scheduledAt),
    }
    const request = (body?: unknown, query = '') =>
      new NextRequest(
        'https://api.test/api' + query,
        body === undefined
          ? {}
          : {
              method: 'POST',
              body: typeof body === 'string' ? body : JSON.stringify(body),
            }
      )
    const endpoints = [
      ['list', () => list(request())],
      ['create', () => create(request('{'))],
      ['scheduled', () => scheduled(request())],
      ['preventive', () => preventive(request('{'))],
      ['update', () => update(request('{'), params)],
      ['complete', () => complete(request('{'), params)],
      ['audit', () => audit(request())],
    ] as const
    beforeEach(() => {
      vi.resetAllMocks()
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-02T12:00:00Z'))
      state.principal.mockResolvedValue({ ok: true, principal })
      state.transaction.mockImplementation(async (_scope, operation) =>
        operation(state.tx)
      )
      state.tx.organization.findUnique.mockResolvedValue({ status: 'ACTIVE' })
      state.tx.equipment.findUnique.mockResolvedValue({
        id: 'equipment-a',
        hourMeter: new Decimal(120),
        odometer: new Decimal(10),
      })
      state.tx.maintenance.findFirst.mockResolvedValue(row)
      state.tx.maintenance.findUnique.mockResolvedValue(row)
      state.tx.maintenance.findMany.mockResolvedValue([row])
      state.tx.maintenance.create.mockResolvedValue(row)
      state.tx.maintenance.update.mockResolvedValue(row)
      state.tx.auditLog.findMany.mockResolvedValue([
        {
          id: 'audit-a',
          tenantId: 'tenant-a',
          user: { id: 'user-a', name: 'Local', email: 'local@example.test' },
        },
      ])
      state.tx.auditLog.count.mockResolvedValue(3)
    })
    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })
    describe('maintenance and audit legacy characterization', () => {
      it.each(endpoints)(
        '%s forwards principal refusal before transaction/body',
        async (_label, run) => {
          state.principal.mockResolvedValue({
            ok: false,
            response: Response.json({ error: 'No session' }, { status: 401 }),
          })
          const response = await run()
          expect(response.status).toBe(401)
          expect(await response.json()).toEqual({ error: 'No session' })
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
      it.each(endpoints)(
        '%s requires ADMIN of the current membership',
        async (_label, run) => {
          state.principal.mockResolvedValue({
            ok: true,
            principal: { ...principal, role: 'OPERATOR' },
          })
          expect((await run()).status).toBe(403)
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
      it('lists descending with scoped inclusive filters and original DTO', async () => {
        const response = await list(
          request(
            undefined,
            '?equipmentId=equipment-a&status=COMPLETED&type=INSPECTION&startDate=2026-01-01&endDate=2026-12-31'
          )
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
          maintenances: JSON.parse(JSON.stringify([row])),
        })
        expect(state.tx.maintenance.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              tenantId: 'tenant-a',
              equipmentId: 'equipment-a',
              status: 'COMPLETED',
              type: 'INSPECTION',
              scheduledAt: {
                gte: new Date('2026-01-01'),
                lte: new Date('2026-12-31'),
              },
            },
            orderBy: { scheduledAt: 'desc' },
          })
        )
      })
      it('scheduled defaults to active states, ascending, no alerts query', async () => {
        const response = await scheduled(request())
        expect(await response.json()).toEqual({
          maintenances: JSON.parse(JSON.stringify([row])),
          overdueAlerts: [],
          overdueCount: 0,
        })
        expect(state.tx.maintenance.findMany).toHaveBeenCalledTimes(1)
        expect(state.tx.maintenance.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              tenantId: 'tenant-a',
              status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
            },
            orderBy: { scheduledAt: 'asc' },
          })
        )
      })
      it('explicit scheduled status replaces defaults; overdue alerts cover the whole tenant', async () => {
        state.tx.maintenance.findMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { ...row, scheduledAt: new Date('2026-09-30T12:00:00Z') },
          ])
        const response = await scheduled(
          request(
            undefined,
            '?equipmentId=other&status=COMPLETED&includeOverdue=true'
          )
        )
        expect((await response.json()).overdueAlerts).toEqual([
          {
            id: row.id,
            equipmentId: row.equipmentId,
            equipmentName: 'Local',
            scheduledAt: '2026-09-30T12:00:00.000Z',
            type: undefined,
            daysOverdue: 2,
          },
        ])
        expect(state.tx.maintenance.findMany.mock.calls[0]![0].where).toEqual({
          tenantId: 'tenant-a',
          equipmentId: 'other',
          status: 'COMPLETED',
        })
        expect(state.tx.maintenance.findMany.mock.calls[1]![0].where).toEqual({
          tenantId: 'tenant-a',
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          scheduledAt: { lt: new Date() },
        })
      })
      it('creates with zero recomputation, discards forged keys, leaves availability alone', async () => {
        const response = await create(
          request({
            ...input,
            cost: 0,
            laborCost: 2.5,
            partsCost: 0,
            tenantId: 'foreign',
            status: 'COMPLETED',
          })
        )
        expect(response.status).toBe(201)
        const data = state.tx.maintenance.create.mock.calls[0]![0].data
        expect(data).toMatchObject({
          tenantId: 'tenant-a',
          status: 'SCHEDULED',
          scheduledAt: new Date(input.scheduledAt),
          cost: new Decimal(2.5),
          laborCost: new Decimal(2.5),
          partsCost: null,
        })
        expect(state.tx.equipment.update).not.toHaveBeenCalled()
      })
      it('creates all zero costs as null', async () => {
        await create(request({ ...input, cost: 0, laborCost: 0, partsCost: 0 }))
        expect(
          state.tx.maintenance.create.mock.calls[0]![0].data
        ).toMatchObject({
          cost: null,
          laborCost: null,
          partsCost: null,
        })
      })
      it.each([
        {},
        { ...input, scheduledAt: 'invalid' },
        { ...input, cost: -1 },
      ])('preserves Zod details for create %j', async (body) => {
        const response = await create(request(body))
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({
          error: 'Validation error',
          details: expect.any(Array),
        })
        expect(state.tx.maintenance.create).not.toHaveBeenCalled()
      })
      it('foreign create equipment returns 404 without INSERT', async () => {
        state.tx.equipment.findUnique.mockResolvedValue(null)
        const response = await create(request(input))
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error: 'Equipamento não encontrado',
        })
        expect(state.tx.maintenance.create).not.toHaveBeenCalled()
      })
      it('PATCH checks ownership before malformed JSON; complete parses JSON before ownership', async () => {
        state.tx.maintenance.findFirst.mockResolvedValue(null)
        expect((await update(request('{'), params)).status).toBe(404)
        state.tx.maintenance.findUnique.mockResolvedValue(null)
        expect((await complete(request('{'), params)).status).toBe(500)
        expect(state.tx.maintenance.findUnique).not.toHaveBeenCalled()
      })
      it('PATCH writes exact zero and empty strings without recomputing total', async () => {
        await update(
          request({
            cost: 0,
            laborCost: 4,
            partsCost: 0,
            description: '',
            notes: '',
            technician: '',
          }),
          params
        )
        expect(state.tx.maintenance.update.mock.calls[0]![0].data).toEqual({
          cost: new Decimal(0),
          laborCost: new Decimal(4),
          partsCost: new Decimal(0),
          description: '',
          notes: '',
          technician: '',
        })
      })
      it('rental conflict prevents start/update/availability writes', async () => {
        state.tx.rental_items.findFirst.mockResolvedValue({
          rentals: { id: 'rental-a' },
        })
        const response = await update(
          request({ status: 'IN_PROGRESS' }),
          params
        )
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
          error: 'Equipamento está locado (Locação rental-a)',
        })
        expect(state.tx.rental_items.findFirst.mock.calls[0]![0].where).toEqual(
          {
            tenantId: 'tenant-a',
            equipmentid: 'equipment-a',
            rentals: {
              status: {
                in: ['PENDING', 'ACTIVE', 'OVERDUE', 'PENDING_RETURN'],
              },
            },
          }
        )
        expect(state.tx.maintenance.update).not.toHaveBeenCalled()
        expect(state.tx.equipment.update).not.toHaveBeenCalled()
      })
      it('starts and marks unavailable in the same scoped transaction', async () => {
        expect(
          (await update(request({ status: 'IN_PROGRESS' }), params)).status
        ).toBe(200)
        expect(state.transaction).toHaveBeenCalledTimes(1)
        expect(state.tx.$executeRaw).toHaveBeenCalledWith(
          expect.anything(),
          'tenant-a'
        )
        expect(state.tx.$executeRaw.mock.calls[0]![0].join('')).toContain(
          'pg_advisory_xact_lock'
        )
        expect(state.tx.equipment.update).toHaveBeenCalledWith({
          where: { tenantId: 'tenant-a', id: 'equipment-a' },
          data: { available: false },
        })
      })
      it('cancel does not free equipment; PATCH completion defaults date and frees only without another active maintenance', async () => {
        await update(request({ status: 'CANCELLED' }), params)
        expect(state.tx.equipment.update).not.toHaveBeenCalled()
        state.tx.maintenance.findFirst
          .mockResolvedValueOnce(row)
          .mockResolvedValueOnce(null)
        await update(request({ status: 'COMPLETED' }), params)
        expect(state.tx.maintenance.update.mock.calls[1]![0].data).toEqual({
          status: 'COMPLETED',
          completedAt: new Date(),
        })
        expect(state.tx.equipment.update).toHaveBeenCalledWith({
          where: { tenantId: 'tenant-a', id: 'equipment-a' },
          data: { available: true },
        })
      })
      it('complete preserves cost on zero, writes zero meters/cost parts and waits for remaining maintenance', async () => {
        const response = await complete(
          request({
            cost: 0,
            laborCost: 0,
            partsCost: 0,
            hourMeter: 0,
            odometer: 0,
            notes: '',
          }),
          params
        )
        expect(response.status).toBe(200)
        expect(state.tx.maintenance.update.mock.calls[0]![0].data).toEqual({
          status: 'COMPLETED',
          completedAt: new Date(),
          laborCost: new Decimal(0),
          partsCost: new Decimal(0),
          notes: '',
        })
        expect(state.tx.equipment.update).toHaveBeenCalledTimes(1)
        expect(state.tx.equipment.update).toHaveBeenCalledWith({
          where: { tenantId: 'tenant-a', id: 'equipment-a' },
          data: { hourMeter: new Decimal(0), odometer: new Decimal(0) },
        })
      })
      it('complete recomputes cost and frees equipment after the last active maintenance', async () => {
        state.tx.maintenance.findFirst.mockResolvedValue(null)
        await complete(request({ laborCost: 1.25, partsCost: 2.75 }), params)
        expect(state.tx.maintenance.update.mock.calls[0]![0].data.cost).toEqual(
          new Decimal(4)
        )
        expect(state.tx.equipment.update).toHaveBeenCalledWith({
          where: { tenantId: 'tenant-a', id: 'equipment-a' },
          data: { available: true },
        })
      })
      it.each([
        {},
        { daysInterval: 0, hoursInterval: 0, rentalsInterval: 0 },
        { hoursInterval: 121 },
      ])('no preventive date returns 400 for %j', async (rules) => {
        state.tx.maintenance.findFirst.mockResolvedValue(null)
        const response = await preventive(
          request({ equipmentId: 'equipment-a', rules })
        )
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
          error: 'Não foi possível calcular data de manutenção',
        })
        expect(state.tx.maintenance.create).not.toHaveBeenCalled()
      })
      it('preventive days uses last completion plus interval and original empty description fallback', async () => {
        state.tx.maintenance.findFirst.mockResolvedValue({
          completedAt: new Date('2026-10-01T12:00:00Z'),
        })
        await preventive(
          request({
            equipmentId: 'equipment-a',
            rules: { daysInterval: 30 },
            description: '',
            tenantId: 'foreign',
          })
        )
        expect(
          state.tx.maintenance.create.mock.calls[0]![0].data
        ).toMatchObject({
          tenantId: 'tenant-a',
          type: 'PREVENTIVE',
          status: 'SCHEDULED',
          scheduledAt: new Date('2026-10-31T12:00:00Z'),
          description: 'Manutenção preventiva agendada automaticamente',
        })
      })
      it.each([{ hoursInterval: 120 }, { rentalsInterval: 2 }])(
        'preventive threshold schedules now for %j',
        async (rules) => {
          state.tx.maintenance.findFirst.mockResolvedValue(null)
          state.tx.rental_items.count.mockResolvedValue(2)
          await preventive(request({ equipmentId: 'equipment-a', rules }))
          expect(
            state.tx.maintenance.create.mock.calls[0]![0].data.scheduledAt
          ).toEqual(new Date())
        }
      )
      it.each([
        '?page=0',
        '?page=1.5',
        '?limit=0',
        '?limit=101',
        '?limit=no',
        '?startDate=invalid',
        '?endDate=invalid',
      ])('audit rejects invalid filters before query %s', async (query) => {
        const response = await audit(request(undefined, query))
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'Filtros inválidos' })
        expect(state.transaction).not.toHaveBeenCalled()
      })
      it('audit applies identical filters to page and total and preserves user fields/pagination', async () => {
        const response = await audit(
          request(
            undefined,
            '?userId=user-a&entity=equipment&entityId=equip-a&action=UPDATE&startDate=2026-01-01&endDate=2026-12-31&page=2&limit=2'
          )
        )
        expect(await response.json()).toMatchObject({
          pagination: { page: 2, limit: 2, total: 3, totalPages: 2 },
          logs: [
            {
              user: {
                id: 'user-a',
                name: 'Local',
                email: 'local@example.test',
              },
            },
          ],
        })
        const call = state.tx.auditLog.findMany.mock.calls[0]![0]
        expect(call).toMatchObject({
          take: 2,
          skip: 2,
          where: {
            tenantId: 'tenant-a',
            userId: 'user-a',
            entity: 'equipment',
            entityId: 'equip-a',
            action: 'UPDATE',
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-12-31'),
            },
          },
        })
        expect(state.tx.auditLog.count).toHaveBeenCalledWith({
          where: call.where,
        })
      })
      it.each([create, preventive])(
        'body is parsed only after acquiring transaction',
        async (handler) => {
          state.transaction.mockRejectedValue(
            new RentalMutationError('Locadora indisponível', 403)
          )
          const response = await handler(request('{'))
          expect(response.status).toBe(403)
          expect(await response.json()).toEqual({
            error: 'Locadora indisponível',
          })
        }
      )
      it('audit unexpected failure remains generic 500', async () => {
        state.tx.auditLog.count.mockRejectedValue(
          new Error('private database details')
        )
        const response = await audit(request())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Internal server error',
        })
      })
    })
  }
)
