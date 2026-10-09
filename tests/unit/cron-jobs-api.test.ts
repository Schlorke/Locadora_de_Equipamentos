import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  equipment: [] as unknown[],
  scheduled: new Set<string>(),
  created: [] as Record<string, unknown>[],
  rentals: [] as unknown[],
  scopes: [] as string[],
  updated: [] as unknown[],
  failReminders: false,
}))
vi.mock('@/lib/security/tenant-cron', () => ({
  runTenantCron: (
    _request: Request,
    job: (_context: { tenantId: string }) => Promise<Response>
  ) => job({ tenantId: 'tenant-a' }),
}))
vi.mock('@/lib/tenant', () => ({
  withTenantTransaction: async (
    context: { tenantId: string },
    operation: (_tx: unknown) => unknown
  ) => {
    state.scopes.push(context.tenantId)
    return operation({
      equipment: { findMany: async () => state.equipment },
      maintenance: {
        findFirst: async (query: { where: { equipmentId: string } }) =>
          state.scheduled.has(query.where.equipmentId)
            ? { id: 'scheduled' }
            : null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          state.created.push(data)
          return data
        },
        findMany: async () => [{ id: 'maintenance-a' }],
      },
      rentals: {
        findMany: async (query: { where: { enddate: { gte?: Date } } }) => {
          if (query.where.enddate.gte && state.failReminders)
            throw new Error('reminder failure')
          return query.where.enddate.gte ? [{ id: 'due-a' }] : state.rentals
        },
        updateMany: async (query: unknown) => {
          state.updated.push(query)
          return { count: 1 }
        },
      },
    })
  },
}))
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('../../apps/services/api/src/host/tenant-cron', () => ({
  runTenantCron: (
    _request: Request,
    job: (_context: { tenantId: string }) => Promise<Response>
  ) => job({ tenantId: 'tenant-a' }),
}))
vi.mock(
  '../../apps/services/api/src/host/tenant-transaction',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/tenant-transaction')
    >()),
    ...(await (() => ({
      withTenantTransaction: async (
        context: { tenantId: string },
        operation: (_tx: unknown) => unknown
      ) => {
        state.scopes.push(context.tenantId)
        return operation({
          equipment: { findMany: async () => state.equipment },
          maintenance: {
            findFirst: async (query: { where: { equipmentId: string } }) =>
              state.scheduled.has(query.where.equipmentId)
                ? { id: 'scheduled' }
                : null,
            create: async ({ data }: { data: Record<string, unknown> }) => {
              state.created.push(data)
              return data
            },
            findMany: async () => [{ id: 'maintenance-a' }],
          },
          rentals: {
            findMany: async (query: { where: { enddate: { gte?: Date } } }) => {
              if (query.where.enddate.gte && state.failReminders)
                throw new Error('reminder failure')
              return query.where.enddate.gte ? [{ id: 'due-a' }] : state.rentals
            },
            updateMany: async (query: unknown) => {
              state.updated.push(query)
              return { count: 1 }
            },
          },
        })
      },
    }))()),
  })
)
import * as legacyRoute0 from '@/app/api/cron/preventive-maintenance/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/cron/preventive-maintenance/route'
import * as legacyRoute1 from '@/app/api/cron/send-notifications/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/cron/send-notifications/route'

const HOSTS = [
  [
    'legacy root',
    {
      maintenance: legacyRoute0.GET,
      notifications: legacyRoute1.GET,
    },
  ],
  [
    'service',
    {
      maintenance: serviceRoute0.GET,
      notifications: serviceRoute1.GET,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { maintenance, notifications }) => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'))
    state.equipment = []
    state.scheduled.clear()
    state.created = []
    state.scopes = []
    state.updated = []
    state.rentals = [{ id: 'late-a' }]
    state.failReminders = false
  })
  afterEach(() => vi.useRealTimers())

  describe('scheduled job characterization', () => {
    it('preserves the 90-day threshold, existing maintenance exclusion and seven-day schedule', async () => {
      const now = Date.now()
      state.equipment = [
        {
          id: 'recent',
          maintenances: [{ completedAt: new Date(now - 89 * 86400000) }],
        },
        {
          id: 'boundary',
          maintenances: [{ completedAt: new Date(now - 90 * 86400000) }],
        },
        { id: 'already', maintenances: [] },
        { id: 'never', maintenances: [] },
      ]
      state.scheduled.add('already')
      const response = await maintenance(
        new NextRequest('https://test.invalid/api/cron/preventive-maintenance')
      )
      expect(await response.json()).toEqual({
        success: true,
        message: 'Processed 4 equipment',
        results: { created: 2, skipped: 2, errors: [] },
      })
      expect(state.created.map((row) => row.equipmentId)).toEqual([
        'boundary',
        'never',
      ])
      expect(
        state.created.every(
          (row) => row.tenantId === 'tenant-a' && row.status === 'SCHEDULED'
        )
      ).toBe(true)
      expect(state.created[0]?.scheduledAt).toEqual(
        new Date(now + 7 * 86400000)
      )
      expect(state.created[1]?.description).toContain('Infinity dias')
      expect(state.scopes.every((scope) => scope === 'tenant-a')).toBe(true)
    })
    it('updates overdue rentals conditionally within tenant scope and keeps the existing counters', async () => {
      const response = await notifications(
        new NextRequest('https://test.invalid/api/cron/send-notifications')
      )
      expect(await response.json()).toEqual({
        success: true,
        message: 'Notifications processed',
        results: {
          rentalReminders: 1,
          overdueAlerts: 1,
          maintenanceAlerts: 1,
          errors: [],
        },
      })
      expect(state.updated).toEqual([
        {
          where: { id: 'late-a', tenantId: 'tenant-a', status: 'ACTIVE' },
          data: { status: 'OVERDUE' },
        },
      ])
      expect(state.scopes.every((scope) => scope === 'tenant-a')).toBe(true)
    })
    it('continues independent notification stages after a reminder query fails', async () => {
      state.failReminders = true
      const response = await notifications(
        new NextRequest('https://test.invalid/api/cron/send-notifications')
      )
      expect(response.status).toBe(200)
      expect((await response.json()).results).toEqual({
        rentalReminders: 0,
        overdueAlerts: 1,
        maintenanceAlerts: 1,
        errors: ['Rental reminders: reminder failure'],
      })
      expect(state.updated).toHaveLength(1)
    })
  })
})
