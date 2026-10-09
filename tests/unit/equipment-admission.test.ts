import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import {
  ENTITLEMENT_FEATURES,
  PlanLimitReachedErrorSchema,
} from '@gb-locacoes/contracts/entitlements'
import {
  createEquipmentAdmission,
  EquipmentAdmissionError,
} from '../../packages/backend/src/modules/entitlements/equipment-admission'

const now = new Date('2026-10-03T16:00:00Z')
const rights = (limit: number | null = 2) => ({
  schema: 1,
  limits: { equipments: limit, staffSeats: 3 },
  features: Object.fromEntries(ENTITLEMENT_FEATURES.map((key) => [key, true])),
})
const tx = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  subscription: { findFirst: vi.fn() },
  entitlementOverride: { findMany: vi.fn() },
  equipment: { count: vi.fn() },
}
const context = { tenantId: 'tenant-fixture' }
const shadow = vi.fn()
const guard = (mode: string | undefined = 'on') =>
  createEquipmentAdmission({ enforcement: () => mode, now: () => now, shadow })(
    tx as unknown as Prisma.TransactionClient,
    context
  )
beforeEach(() => {
  vi.resetAllMocks()
  tx.$queryRaw.mockResolvedValue([
    { id: context.tenantId, access: 'FULL', status: 'ACTIVE' },
  ])
  tx.$executeRaw.mockResolvedValue(0)
  tx.subscription.findFirst.mockResolvedValue({
    planVersion: { entitlements: rights() },
  })
  tx.entitlementOverride.findMany.mockResolvedValue([])
  tx.equipment.count.mockResolvedValue(1)
})
describe('equipment admission policy', () => {
  it('a failing diagnostic sink never blocks shadow admission', async () => {
    shadow.mockImplementation(() => {
      throw new Error('diagnostic failure')
    })
    await guard('shadow')
  })
  it.each(['off', undefined])(
    'mode %s preserves legacy without reading plan/locks',
    async (mode) => {
      // Explicit undefined uses the factory default off, rather than this helper's on default.
      await createEquipmentAdmission({ enforcement: () => mode })(
        tx as unknown as Prisma.TransactionClient,
        context
      )
      expect(tx.$queryRaw).not.toHaveBeenCalled()
      expect(tx.subscription.findFirst).not.toHaveBeenCalled()
      expect(tx.equipment.count).not.toHaveBeenCalled()
    }
  )
  it.each(['ON', '', 'invalid'])(
    'invalid mode %s refuses before writes',
    async (mode) => {
      await expect(guard(mode)).rejects.toMatchObject({ status: 503 })
      expect(tx.$queryRaw).not.toHaveBeenCalled()
    }
  )
  it.each(['FULL', 'SETUP'])(
    'allows %s within quota with tenant-scoped reads and quota lock',
    async (access) => {
      tx.$queryRaw.mockResolvedValue([
        { id: context.tenantId, access, status: 'ACTIVE' },
      ])
      await guard()
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
      expect(tx.$executeRaw.mock.calls[0]?.[1]).toBe(
        context.tenantId + ':quota:equipments'
      )
      expect(tx.subscription.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: context.tenantId, status: { not: 'CANCELED' } },
        })
      )
      expect(tx.equipment.count).toHaveBeenCalledWith({
        where: { tenantId: context.tenantId },
      })
      expect(tx.entitlementOverride.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: context.tenantId,
            createdAt: { lte: now },
          }),
        })
      )
    }
  )
  it.each([
    ['RESTRICTED', 402, 'SUBSCRIPTION_RESTRICTED'],
    ['ARCHIVED', 403, 'TENANT_ARCHIVED'],
  ] as const)('refuses %s before quota reads', async (access, status, code) => {
    tx.$queryRaw.mockResolvedValue([
      { id: context.tenantId, access, status: 'ACTIVE' },
    ])
    await expect(guard()).rejects.toMatchObject({ status, body: { code } })
    expect(tx.equipment.count).not.toHaveBeenCalled()
  })
  it.each([2, 7])(
    'at/above quota (%s) returns the published strict envelope',
    async (used) => {
      tx.equipment.count.mockResolvedValue(used)
      const error = await guard().catch((e: unknown) => e)
      expect(error).toBeInstanceOf(EquipmentAdmissionError)
      const body = (error as EquipmentAdmissionError).body
      expect(PlanLimitReachedErrorSchema.parse(body)).toMatchObject({
        resource: 'equipments',
        limit: 2,
        used,
      })
    }
  )
  it('allows unlimited without silently taking a stale canceled subscription', async () => {
    tx.subscription.findFirst.mockResolvedValue({
      planVersion: { entitlements: rights(null) },
    })
    tx.equipment.count.mockResolvedValue(100)
    await guard()
  })
  it.each([
    null,
    {},
    {
      planVersion: { entitlements: { ...rights(), limits: { equipments: 2 } } },
    },
  ])('missing/invalid plan fails closed: %j', async (subscription) => {
    tx.subscription.findFirst.mockResolvedValue(subscription)
    await expect(guard()).rejects.toMatchObject({ status: 503 })
  })
  it('applies only valid, current overrides', async () => {
    const row = {
      key: 'limits.equipments',
      value: 5,
      createdAt: new Date(now.getTime() - 1000),
      expiresAt: null,
      revokedAt: null,
    }
    tx.equipment.count.mockResolvedValue(4)
    tx.entitlementOverride.findMany.mockResolvedValue([
      row,
      { ...row, value: '999', createdAt: now },
      { ...row, value: 0, createdAt: now },
      { ...row, value: 999, expiresAt: now },
    ])
    await guard()
    tx.entitlementOverride.findMany.mockResolvedValue([
      { ...row, expiresAt: now },
    ])
    await expect(guard()).rejects.toMatchObject({
      body: { code: 'PLAN_LIMIT_REACHED', limit: 2 },
    })
  })
  it.each(['RESTRICTED', 'ARCHIVED'])(
    'shadow records %s without refusing or leaving a failed transaction',
    async (access) => {
      tx.$queryRaw.mockResolvedValue([
        { id: context.tenantId, access, status: 'ACTIVE' },
      ])
      await guard('shadow')
      expect(shadow).toHaveBeenCalledWith({
        tenantId: context.tenantId,
        code:
          access === 'ARCHIVED' ? 'TENANT_ARCHIVED' : 'SUBSCRIPTION_RESTRICTED',
      })
      expect(tx.$executeRaw.mock.calls.map((c) => c[0][0])).toEqual([
        'SAVEPOINT equipment_admission_shadow',
        'ROLLBACK TO SAVEPOINT equipment_admission_shadow',
        'RELEASE SAVEPOINT equipment_admission_shadow',
      ])
    }
  )
  it('shadow observes full quota and successful admission using redacted stable fields', async () => {
    tx.equipment.count.mockResolvedValue(2)
    await guard('shadow')
    expect(shadow).toHaveBeenLastCalledWith({
      tenantId: context.tenantId,
      code: 'PLAN_LIMIT_REACHED',
    })
    tx.equipment.count.mockResolvedValue(1)
    await guard('shadow')
    expect(shadow).toHaveBeenLastCalledWith({
      tenantId: context.tenantId,
      code: 'ALLOWED',
    })
  })
  it('shadow rolls back SQL failures and never logs their content', async () => {
    tx.subscription.findFirst.mockRejectedValue(
      new Error('secret or SQL diagnostic')
    )
    await guard('shadow')
    expect(shadow).toHaveBeenCalledWith({
      tenantId: context.tenantId,
      code: 'SUBSCRIPTION_POLICY_UNAVAILABLE',
    })
    await expect(guard()).rejects.toMatchObject({
      status: 503,
      message: 'Não foi possível verificar os limites do plano.',
    })
  })
})
