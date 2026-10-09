import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'
import {
  SUBSCRIPTION_ACCESS,
  SubscriptionSummarySchema,
  PlatformInvoicesResponseSchema,
} from '@gb-locacoes/contracts/subscription'
import { createOwnerSubscriptionReadHandlers } from '@gb-locacoes/backend/http'

const principal = {
  tenantId: 'alfa',
  membershipId: 'member-alfa',
  userId: 'owner-alfa',
  role: 'ADMIN' as const,
}
const instant = new Date('2026-10-04T12:00:00Z')
const rights = () => ({
  schema: 1,
  limits: { equipments: 20, staffSeats: 3 },
  features: Object.fromEntries(ENTITLEMENT_FEATURES.map((key) => [key, false])),
})
const plan = () => ({
  version: 1,
  interval: 'MONTHLY',
  amount: new Prisma.Decimal('149.90'),
  entitlements: rights(),
  plan: { code: 'fixture', name: 'Synthetic plan' },
})
const subscription = () => ({
  status: 'ACTIVE',
  billingMode: 'ASAAS',
  planVersion: plan(),
  scheduledPlanVersion: null,
  scheduledChangeAt: null,
  trialEndsAt: null,
  currentPeriodStart: new Date('2026-10-01T00:00:00Z'),
  currentPeriodEnd: new Date('2026-11-01T00:00:00Z'),
  pastDueSince: null,
  graceEndsAt: null,
  suspendedAt: null,
  complimentaryUntil: null,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  cancelReason: null,
})
const invoice = () => ({
  id: 'invoice-alfa',
  kind: 'CYCLE',
  status: 'PENDING',
  amount: new Prisma.Decimal('149.90'),
  dueDate: new Date('2026-10-04T00:00:00Z'),
  periodStart: null,
  periodEnd: null,
  billingType: 'PIX',
  invoiceUrl: 'https://www.asaas.com/i/fixture',
  paidAt: null,
  canceledReason: null,
})
const tx = {
  $executeRaw: vi.fn(),
  membership: { findFirst: vi.fn(), count: vi.fn() },
  subscription: { findFirst: vi.fn() },
  equipment: { count: vi.fn() },
  entitlementOverride: { findMany: vi.fn() },
  platformInvoice: { findMany: vi.fn() },
}
const transaction = vi.fn()
const handlers = () =>
  createOwnerSubscriptionReadHandlers({
    withTenantTransaction: transaction,
    now: () => instant,
  })
const ownership = (
  access = 'FULL',
  ownerUserId: string | null = principal.userId
) =>
  tx.membership.findFirst.mockResolvedValue({
    organization: { status: 'ACTIVE', access, ownerUserId },
  })
async function read(
  kind: 'summary' | 'invoices' = 'summary',
  actor = principal
) {
  const reader = handlers()
  const response = await (kind === 'summary'
    ? reader.readOwnerSubscription(actor)
    : reader.readOwnerInvoices(actor))
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(response.headers.get('Vary')).toBe('Cookie, Host')
  return { status: response.status, body: await response.json() }
}
beforeEach(() => {
  vi.resetAllMocks()
  transaction.mockImplementation(async (_context, operation) => operation(tx))
  tx.$executeRaw.mockResolvedValue(0)
  ownership()
  tx.subscription.findFirst.mockResolvedValue(subscription())
  tx.equipment.count.mockResolvedValue(4)
  tx.membership.count.mockResolvedValue(2)
  tx.entitlementOverride.findMany.mockResolvedValue([])
  tx.platformInvoice.findMany.mockResolvedValue([invoice()])
})
describe('owner subscription reads', () => {
  it('keeps civil dates, exact money, usage and an explicit repeatable-read tenant snapshot', async () => {
    const result = await read()
    expect(result.status).toBe(200)
    expect(SubscriptionSummarySchema.parse(result.body)).toMatchObject({
      plan: { amount: '149.90' },
      currentPeriodStart: '2026-10-01',
      currentPeriodEnd: '2026-11-01',
      usage: { equipments: 4, staffSeats: 2 },
    })
    expect(transaction).toHaveBeenCalledWith(principal, expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    })
    expect(tx.$executeRaw).toHaveBeenCalledWith(['SET TRANSACTION READ ONLY'])
    expect(tx.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: principal.membershipId,
          tenantId: principal.tenantId,
          userId: principal.userId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      })
    )
    expect(tx.membership.count).toHaveBeenCalledWith({
      where: { tenantId: 'alfa', status: 'ACTIVE', role: { not: 'CLIENT' } },
    })
  })
  it.each(Object.entries(SUBSCRIPTION_ACCESS))(
    'returns persisted %s without recomputing or changing state',
    async (status, access) => {
      ownership(access)
      const sub = {
        ...subscription(),
        status,
        canceledAt: status === 'CANCELED' ? instant : null,
      }
      if (status === 'CANCELED')
        tx.subscription.findFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(sub)
      else tx.subscription.findFirst.mockResolvedValue(sub)
      const result = await read()
      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({ status, access })
    }
  )
  it.each(['summary', 'invoices'] as const)(
    'ignores forged owner metadata for %s before accessing commercial data',
    async (kind) => {
      ownership('FULL', 'another-owner')
      const result = await read(kind, {
        ...principal,
        isOwner: true,
      } as typeof principal)
      expect(result).toMatchObject({
        status: 403,
        body: { code: 'OWNER_REQUIRED' },
      })
      expect(tx.subscription.findFirst).not.toHaveBeenCalled()
      expect(tx.platformInvoice.findMany).not.toHaveBeenCalled()
    }
  )
  it.each([null, 'another-owner'])(
    'does not select an owner automatically when ownerUserId is %s',
    async (owner) => {
      ownership('FULL', owner)
      expect((await read()).status).toBe(403)
    }
  )
  it('refuses a revoked/mismatched membership and a suspended organization', async () => {
    tx.membership.findFirst.mockResolvedValue(null)
    expect((await read()).status).toBe(403)
    tx.membership.findFirst.mockResolvedValue({
      organization: {
        access: 'FULL',
        status: 'SUSPENDED',
        ownerUserId: principal.userId,
      },
    })
    expect((await read()).status).toBe(403)
  })
  it('returns 404 rather than inventing a subscription for legacy ownership', async () => {
    tx.subscription.findFirst.mockResolvedValue(null)
    expect(await read()).toMatchObject({
      status: 404,
      body: { code: 'SUBSCRIPTION_NOT_FOUND' },
    })
  })
  it('returns the latest canceled history only if no live subscription exists', async () => {
    ownership('ARCHIVED')
    tx.subscription.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...subscription(),
        status: 'CANCELED',
        canceledAt: instant,
      })
    expect((await read()).status).toBe(200)
    expect(tx.subscription.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { tenantId: 'alfa', status: 'CANCELED' },
        orderBy: [
          { canceledAt: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      })
    )
  })
  it('applies only currently valid exceptions using the shared domain rule', async () => {
    tx.entitlementOverride.findMany.mockResolvedValue([
      {
        key: 'limits.equipments',
        value: 40,
        createdAt: instant,
        expiresAt: null,
        revokedAt: null,
      },
      {
        key: 'features.whatsapp',
        value: true,
        createdAt: instant,
        expiresAt: new Date('2026-10-03T12:00:00Z'),
        revokedAt: null,
      },
    ])
    const result = await read()
    expect(result.status).toBe(200)
    expect(result.body.entitlements.limits.equipments).toBe(40)
    expect(result.body.entitlements.features.whatsapp).toBe(false)
  })
  it.each(['projection', 'rights', 'scheduled'])(
    'fails closed on inconsistent %s data',
    async (caseName) => {
      if (caseName === 'projection') ownership('ARCHIVED')
      if (caseName === 'rights')
        tx.subscription.findFirst.mockResolvedValue({
          ...subscription(),
          planVersion: { ...plan(), entitlements: { schema: 99 } },
        })
      if (caseName === 'scheduled')
        tx.subscription.findFirst.mockResolvedValue({
          ...subscription(),
          scheduledChangeAt: instant,
        })
      expect(await read()).toEqual({
        status: 503,
        body: { error: 'Não foi possível consultar a assinatura.' },
      })
    }
  )
  it('preserves scheduled plan and exact civil change date', async () => {
    tx.subscription.findFirst.mockResolvedValue({
      ...subscription(),
      scheduledChangeAt: new Date('2026-11-01T00:00:00Z'),
      scheduledPlanVersion: { ...plan(), version: 2 },
    })
    expect(await read()).toMatchObject({
      status: 200,
      body: { scheduledChangeAt: '2026-11-01', scheduledPlan: { version: 2 } },
    })
  })
  it('returns only invoice DTO fields from all this tenant history, with the contract limit and stable order', async () => {
    const result = await read('invoices')
    expect(result.status).toBe(200)
    expect(PlatformInvoicesResponseSchema.parse(result.body).invoices).toEqual([
      { ...invoice(), amount: '149.90', dueDate: '2026-10-04' },
    ])
    expect(tx.platformInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'alfa' },
        take: 100,
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      })
    )
  })
  it('accepts empty invoice history without creating a billing record', async () => {
    tx.platformInvoice.findMany.mockResolvedValue([])
    expect(await read('invoices')).toEqual({
      status: 200,
      body: { invoices: [] },
    })
  })
  it.each([
    'https://evil.invalid/secret',
    'https://user@www.asaas.com/i/fixture',
    'http://www.asaas.com/i/fixture',
  ])(
    'refuses persisted invoice URL %s without leaking it',
    async (invoiceUrl) => {
      tx.platformInvoice.findMany.mockResolvedValue([
        { ...invoice(), invoiceUrl },
      ])
      expect(await read('invoices')).toEqual({
        status: 503,
        body: { error: 'Não foi possível consultar a assinatura.' },
      })
    }
  )
  it('hides database failures in a private response', async () => {
    transaction.mockRejectedValue(new Error('private-database-credential'))
    expect((await read()).body).toEqual({
      error: 'Não foi possível consultar a assinatura.',
    })
  })
})
