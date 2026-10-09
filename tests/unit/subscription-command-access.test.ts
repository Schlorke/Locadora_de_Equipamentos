import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'
import { createSubscriptionCommandAccess } from '../../packages/backend/src/modules/entitlements/command-admission'
import { createVehicleService } from '../../packages/backend/src/modules/operations/vehicles'
import { createDeliveryService } from '../../packages/backend/src/modules/operations/deliveries'
import { createMaintenanceService } from '../../packages/backend/src/modules/operations/maintenance'
import { createPaymentRequests } from '../../packages/backend/src/modules/billing/payment-request'
import { PaymentRequestError } from '@gb-locacoes/backend/billing'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'

const context = {
  tenantId: 'tenant-alfa',
  userId: 'owner-alfa',
  membershipId: 'member-alfa',
  role: 'ADMIN' as const,
  access: 'FULL' as const,
}
const instant = new Date('2026-10-04T12:00:00Z')
const rights = () => ({
  schema: 1,
  limits: { equipments: 20, staffSeats: 3 },
  features: Object.fromEntries(ENTITLEMENT_FEATURES.map((key) => [key, true])),
})
const mock = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  subscription: { findFirst: vi.fn() },
  entitlementOverride: { findMany: vi.fn() },
  rentals: { findFirst: vi.fn() },
  quote: { findFirst: vi.fn() },
  clientProfile: { findFirst: vi.fn() },
  payment: { aggregate: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  vehicle: { create: vi.fn() },
  delivery: { create: vi.fn(), update: vi.fn() },
  maintenance: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}
const tx = mock as unknown as Prisma.TransactionClient
const mode = (enforcement = 'on') =>
  createSubscriptionCommandAccess({
    enforcement: () => enforcement,
    now: () => instant,
  })
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
  mock.$queryRaw.mockResolvedValue([
    { id: context.tenantId, status: 'ACTIVE', access: 'FULL' },
  ])
  mock.subscription.findFirst.mockResolvedValue({
    planVersion: { entitlements: rights() },
    suspendedAt: instant,
  })
  mock.entitlementOverride.findMany.mockResolvedValue([])
  mock.rentals.findFirst.mockResolvedValue({ id: 'ongoing' })
})
describe('subscription admission inside the command transaction', () => {
  it.each(['FULL', 'SETUP', 'RESTRICTED'])(
    '%s permits only the own profile without requiring a commercial plan',
    async (access) => {
      mock.$queryRaw.mockResolvedValue([
        { id: context.tenantId, status: 'ACTIVE', access },
      ])
      await mode()(tx, context, { ownProfileUserId: context.userId })
      expect(mock.subscription.findFirst).not.toHaveBeenCalled()
    }
  )
  it.each(['SETUP', 'RESTRICTED', 'ARCHIVED'])(
    'own-profile exception cannot bypass %s for another user or an archived tenant',
    async (access) => {
      mock.$queryRaw.mockResolvedValue([
        { id: context.tenantId, status: 'ACTIVE', access },
      ])
      await expect(
        mode()(tx, context, {
          ownProfileUserId:
            access === 'ARCHIVED' ? context.userId : 'foreign-user',
        })
      ).rejects.toMatchObject({ status: access === 'ARCHIVED' ? 403 : 402 })
    }
  )
  const obligations = [
    { rentalReturn: {} },
    { rentalReturn: { damageFee: 12.34, notes: 'Returned' } },
    { rentalClose: { status: 'COMPLETED', notes: 'Closed' } },
    { settlement: { billingStatus: 'PAID', paidAt: instant } },
    { settlement: { billingStatus: 'SETTLED', invoiceNumber: 'old-invoice' } },
  ]
  it.each(obligations)(
    'RESTRICTED accepts only an existing obligation: %j',
    async (operation) => {
      mock.$queryRaw.mockResolvedValue([
        { id: context.tenantId, status: 'ACTIVE', access: 'RESTRICTED' },
      ])
      await mode()(tx, context, operation)
      expect(mock.subscription.findFirst).not.toHaveBeenCalled()
    }
  )
  it.each([
    { rentalReturn: { damageFee: -1 } },
    { rentalReturn: { equipmentId: 'new' } },
    { rentalClose: { status: 'COMPLETED', extensionDays: 1 } },
    { rentalClose: { status: 'CANCELLED' } },
    { settlement: { billingStatus: 'UNPAID' } },
    { settlement: { billingStatus: 'AWAITING_PAYMENT' } },
    { settlement: { billingStatus: 'PAID', amount: 500 } },
  ])('RESTRICTED refuses mixed or new operations: %j', async (operation) => {
    mock.$queryRaw.mockResolvedValue([
      { id: context.tenantId, status: 'ACTIVE', access: 'RESTRICTED' },
    ])
    await expect(mode()(tx, context, operation)).rejects.toMatchObject({
      status: 402,
      body: { code: 'SUBSCRIPTION_RESTRICTED' },
    })
  })
  it.each(['SETUP', 'ARCHIVED'])(
    'obligation exceptions never bypass %s',
    async (access) => {
      mock.$queryRaw.mockResolvedValue([
        { id: context.tenantId, status: 'ACTIVE', access },
      ])
      for (const operation of obligations)
        await expect(mode()(tx, context, operation)).rejects.toMatchObject({
          status: access === 'SETUP' ? 402 : 403,
        })
    }
  )
  it('RESTRICTED reissue requires this tenant active boleto, not a newly requested charge', async () => {
    mock.$queryRaw.mockResolvedValue([
      { id: context.tenantId, status: 'ACTIVE', access: 'RESTRICTED' },
    ])
    mock.payment.findFirst.mockResolvedValue({ id: 'old-charge' })
    await mode()(tx, context, { reissuePaymentId: 'old-charge' })
    expect(mock.payment.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'old-charge',
        tenantId: context.tenantId,
        method: 'BOLETO',
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      select: { id: true },
    })
    mock.payment.findFirst.mockResolvedValue(null)
    await expect(
      mode()(tx, context, { reissuePaymentId: 'foreign-or-closed' })
    ).rejects.toMatchObject({ status: 402 })
  })
  it('off touches no database or savepoint', async () => {
    await mode('off')(tx, context, { feature: 'onlinePayments' })
    expect(mock.$queryRaw).not.toHaveBeenCalled()
    expect(mock.$executeRaw).not.toHaveBeenCalled()
    expect(mock.subscription.findFirst).not.toHaveBeenCalled()
  })
  it.each(['', 'ON', 'invalid'])(
    'invalid flag %s fails closed',
    async (setting) => {
      await expect(
        mode(setting)(tx, context, { feature: 'logistics' })
      ).rejects.toMatchObject({ status: 503 })
      expect(mock.$queryRaw).not.toHaveBeenCalled()
    }
  )
  it.each(['logistics', 'maintenance', 'onlinePayments'] as const)(
    'reads the current %s module, ignoring stale FULL metadata',
    async (feature) => {
      const data = rights()
      data.features[feature] = false
      mock.subscription.findFirst.mockResolvedValue({
        planVersion: { entitlements: data },
      })
      await expect(mode()(tx, context, { feature })).rejects.toMatchObject({
        status: 402,
        body: { code: 'MODULE_NOT_IN_PLAN', feature },
      })
      expect(mock.$queryRaw.mock.calls[0]?.[0].join('')).toContain('FOR UPDATE')
      expect(mock.$queryRaw.mock.calls[0]?.[1]).toBe(context.tenantId)
    }
  )
  it.each([
    ['SETUP', 402, 'SUBSCRIPTION_RESTRICTED'],
    ['RESTRICTED', 402, 'SUBSCRIPTION_RESTRICTED'],
    ['ARCHIVED', 403, 'TENANT_ARCHIVED'],
  ] as const)(
    'current %s stops a command with stale FULL metadata',
    async (access, status, code) => {
      mock.$queryRaw.mockResolvedValue([
        { id: context.tenantId, status: 'ACTIVE', access },
      ])
      await expect(
        mode()(tx, context, { feature: 'maintenance' })
      ).rejects.toMatchObject({ status, body: { code } })
      expect(mock.subscription.findFirst).not.toHaveBeenCalled()
    }
  )
  it.each([
    { rows: [] },
    { rows: [{ id: context.tenantId, status: 'SUSPENDED', access: 'FULL' }] },
  ])(
    'administrative denial is separate from the commercial state',
    async ({ rows }) => {
      mock.$queryRaw.mockResolvedValue(rows)
      await expect(
        mode()(tx, context, { feature: 'logistics' })
      ).rejects.toMatchObject({ status: 403 })
    }
  )
  it('a valid tenant override enables the disabled module without changing the plan', async () => {
    const data = rights()
    data.features.logistics = false
    mock.subscription.findFirst.mockResolvedValue({
      planVersion: { entitlements: data },
    })
    mock.entitlementOverride.findMany.mockResolvedValue([
      {
        key: 'features.logistics',
        value: true,
        createdAt: new Date(instant.getTime() - 1000),
        revokedAt: null,
        expiresAt: null,
      },
    ])
    await mode()(tx, context, { feature: 'logistics' })
    expect(
      mock.entitlementOverride.findMany.mock.calls[0]?.[0].where.tenantId
    ).toBe(context.tenantId)
  })
  it('a malformed override cannot enable a module', async () => {
    const data = rights()
    data.features.logistics = false
    mock.subscription.findFirst.mockResolvedValue({
      planVersion: { entitlements: data },
    })
    mock.entitlementOverride.findMany.mockResolvedValue([
      {
        key: 'features.logistics',
        value: 1,
        createdAt: instant,
        revokedAt: null,
        expiresAt: null,
      },
    ])
    await expect(
      mode()(tx, context, { feature: 'logistics' })
    ).rejects.toMatchObject({ body: { code: 'MODULE_NOT_IN_PLAN' } })
  })
  it.each([undefined, { schema: 1 }])(
    'missing or malformed plan fails closed',
    async (entitlements) => {
      mock.subscription.findFirst.mockResolvedValue({
        planVersion: { entitlements },
      })
      await expect(
        mode()(tx, context, { feature: 'onlinePayments' })
      ).rejects.toMatchObject({ status: 503 })
    }
  )
  it('strict completion of an existing delivery remains available in RESTRICTED', async () => {
    mock.$queryRaw.mockResolvedValue([
      { id: context.tenantId, status: 'ACTIVE', access: 'RESTRICTED' },
    ])
    await mode()(tx, context, {
      feature: 'logistics',
      delivery: {
        status: 'COMPLETED',
        completedAt: instant,
        notes: 'Returned',
        photos: [],
      },
    })
    expect(mock.subscription.findFirst).not.toHaveBeenCalled()
  })
  it.each([
    { status: 'COMPLETED', driverId: 'new-driver' },
    { status: 'CANCELLED' },
    { status: 'COMPLETED', completedAt: new Date('invalid') },
  ])('completion cannot smuggle another operation: %j', async (delivery) => {
    mock.$queryRaw.mockResolvedValue([
      { id: context.tenantId, status: 'ACTIVE', access: 'RESTRICTED' },
    ])
    await expect(
      mode()(tx, context, { feature: 'logistics', delivery: delivery as never })
    ).rejects.toMatchObject({ body: { code: 'SUBSCRIPTION_RESTRICTED' } })
  })
  it('RESTRICTED payment requires an unreturned rental checked out before suspension', async () => {
    mock.$queryRaw.mockResolvedValue([
      { id: context.tenantId, status: 'ACTIVE', access: 'RESTRICTED' },
    ])
    await mode()(tx, context, {
      feature: 'onlinePayments',
      payment: { rentalId: 'ongoing' },
    })
    expect(mock.rentals.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'ongoing',
        tenantId: context.tenantId,
        status: { in: ['ACTIVE', 'OVERDUE', 'PENDING_RETURN'] },
        checkOutAt: { lt: instant },
        checkInAt: null,
      },
      select: { id: true },
    })
    expect(mock.entitlementOverride.findMany).not.toHaveBeenCalled()
  })
  it.each([
    { quoteId: 'quote' },
    { rentalId: 'rental', quoteId: 'quote' },
    { rentalId: 'rental', quoteId: null },
  ])('RESTRICTED refuses quote or ambiguous reference %j', async (payment) => {
    mock.$queryRaw.mockResolvedValue([
      { id: context.tenantId, status: 'ACTIVE', access: 'RESTRICTED' },
    ])
    await expect(
      mode()(tx, context, { feature: 'onlinePayments', payment })
    ).rejects.toMatchObject({ body: { code: 'SUBSCRIPTION_RESTRICTED' } })
    expect(mock.rentals.findFirst).not.toHaveBeenCalled()
  })
  it('a rental that ceased to qualify after HTTP admission is refused', async () => {
    mock.$queryRaw.mockResolvedValue([
      { id: context.tenantId, status: 'ACTIVE', access: 'RESTRICTED' },
    ])
    mock.rentals.findFirst.mockResolvedValue(null)
    await expect(
      mode()(tx, context, {
        feature: 'onlinePayments',
        payment: { rentalId: 'ongoing' },
      })
    ).rejects.toMatchObject({ status: 402 })
  })
  it('shadow rolls back its SQL failure to a savepoint, and a failing diagnostic cannot block the write', async () => {
    mock.subscription.findFirst.mockRejectedValue(new Error('SQL denied'))
    const guard = createSubscriptionCommandAccess({
      enforcement: () => 'shadow',
      shadow: () => {
        throw new Error('sink unavailable')
      },
    })
    await guard(tx, context, { feature: 'logistics' })
    expect(mock.$executeRaw.mock.calls.map((call) => call[0].join(''))).toEqual(
      [
        'SAVEPOINT subscription_command_shadow',
        'ROLLBACK TO SAVEPOINT subscription_command_shadow',
        'RELEASE SAVEPOINT subscription_command_shadow',
      ]
    )
  })
})
describe('real shared services enforce admission before their effects', () => {
  const runner = async <T>(
    _context: unknown,
    operation: (_tx: Prisma.TransactionClient) => Promise<T>
  ) => operation(tx)
  beforeEach(() => {
    mock.$queryRaw.mockResolvedValue([
      { id: context.tenantId, status: 'ACTIVE', access: 'RESTRICTED' },
    ])
  })
  it('vehicle creation is stopped before INSERT', async () => {
    await expect(
      createVehicleService({ withRentalTransaction: runner }).createVehicle(
        context,
        async () => ({ plate: 'FIXTURE' })
      )
    ).rejects.toBeInstanceOf(RentalMutationError)
    expect(mock.vehicle.create).not.toHaveBeenCalled()
  })
  it('new delivery is stopped before INSERT', async () => {
    await expect(
      createDeliveryService({ withTenantTransaction: runner }).createDelivery(
        context,
        async () => ({ rentalId: 'rental' }) as never
      )
    ).rejects.toMatchObject({ policy: { code: 'SUBSCRIPTION_RESTRICTED' } })
    expect(mock.delivery.create).not.toHaveBeenCalled()
  })
  it.each([
    'createMaintenance',
    'schedulePreventiveMaintenance',
    'updateMaintenance',
    'completeMaintenance',
  ] as const)('%s is stopped before UPDATE or INSERT', async (method) => {
    const service = createMaintenanceService({ withRentalTransaction: runner })
    mock.maintenance.findFirst.mockResolvedValue({ id: 'existing' })
    const invocation =
      method === 'updateMaintenance'
        ? service[method](context, 'existing', async () => ({}))
        : method === 'completeMaintenance'
          ? service[method](context, async () => ({ id: 'existing', data: {} }))
          : service[method](context, async () => ({}) as never)
    await expect(invocation).rejects.toMatchObject({
      policy: { code: 'SUBSCRIPTION_RESTRICTED' },
    })
    expect(mock.maintenance.create).not.toHaveBeenCalled()
    expect(mock.maintenance.update).not.toHaveBeenCalled()
  })
  it.each(['PIX', 'BOLETO'] as const)(
    '%s still verifies ownership before commercial admission',
    async (method) => {
      mock.rentals.findFirst.mockResolvedValue({
        id: 'rental',
        userid: 'another-user',
        status: 'ACTIVE',
      })
      const service = createPaymentRequests({
        withRentalTransaction: runner,
        readTenantProviderCharge: vi.fn(),
        resolveIntegrationCredential: vi.fn(),
      })
      await expect(
        service.requestPayment(
          { ...context, role: 'CLIENT' },
          { rentalId: 'rental', amount: 10, dueDate: instant },
          method
        )
      ).rejects.toMatchObject({ status: 404 })
      expect(mock.$queryRaw).not.toHaveBeenCalled()
      expect(mock.payment.create).not.toHaveBeenCalled()
    }
  )
  it.each(['PIX', 'BOLETO'] as const)(
    '%s blocks a new quote charge before Payment/attempt/outbox',
    async (method) => {
      mock.quote.findFirst.mockResolvedValue({
        id: 'quote',
        userId: context.userId,
        status: 'APPROVED',
        approvedAt: instant,
        total: 10,
      })
      mock.payment.aggregate.mockResolvedValue({ _sum: { amount: null } })
      mock.clientProfile.findFirst.mockResolvedValue({
        name: 'Local',
        email: 'local@example.invalid',
        document: '123',
      })
      const service = createPaymentRequests({
        withRentalTransaction: runner,
        readTenantProviderCharge: vi.fn(),
        resolveIntegrationCredential: vi.fn(),
      })
      await expect(
        service.requestPayment(
          context,
          { quoteId: 'quote', amount: 10, dueDate: instant },
          method
        )
      ).rejects.toBeInstanceOf(PaymentRequestError)
      expect(mock.payment.create).not.toHaveBeenCalled()
    }
  )
})
