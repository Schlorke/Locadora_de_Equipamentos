import {
  SUBSCRIPTION_ACCESS,
  type PlatformInvoice,
  type PublicPlan,
  type SubscriptionStatus,
  type SubscriptionSummary,
} from '@gb-locacoes/contracts/subscription'
import type { TenantContext } from '@gb-locacoes/contracts'

/** Dados exclusivamente sintéticos; não definem planos/preços comerciais. */
export function subscriptionFixture(
  status: SubscriptionStatus = 'ACTIVE'
): SubscriptionSummary {
  return {
    status,
    access: SUBSCRIPTION_ACCESS[status],
    billingMode: 'ASAAS',
    plan: {
      code: 'fixture',
      name: 'Plano de teste',
      version: 1,
      interval: 'MONTHLY',
      amount: '199.90',
    },
    scheduledPlan: null,
    scheduledChangeAt: null,
    trialEndsAt: '2026-10-15',
    currentPeriodStart: '2026-10-01',
    currentPeriodEnd: '2026-10-31',
    pastDueSince: null,
    graceEndsAt: null,
    suspendedAt: null,
    complimentaryUntil: null,
    cancelAtPeriodEnd: false,
    canceledAt: status === 'CANCELED' ? '2026-10-04T12:00:00Z' : null,
    cancelReason: null,
    entitlements: {
      schema: 1,
      limits: { equipments: 30, staffSeats: null },
      features: {
        onlinePayments: true,
        customDomain: false,
        logistics: true,
        maintenance: true,
        contractSignature: false,
        whatsapp: false,
        emailInbox: false,
        merchantFeed: false,
      },
    },
    usage: { equipments: 7, staffSeats: 2 },
  }
}
export function invoiceFixture(
  overrides: Partial<PlatformInvoice> = {}
): PlatformInvoice {
  return {
    id: 'invoice-fixture',
    kind: 'CYCLE',
    status: 'PENDING',
    amount: '199.90',
    dueDate: '2026-10-04',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    billingType: 'UNDEFINED',
    invoiceUrl: 'https://www.asaas.com/i/fixture',
    paidAt: null,
    canceledReason: null,
    ...overrides,
  }
}

export function subscriptionOfferFixture(
  overrides: Partial<PublicPlan> = {}
): PublicPlan {
  const summary = subscriptionFixture()
  return {
    ...summary.plan,
    planVersionId: 'offer-fixture',
    trialDays: 14,
    entitlements: summary.entitlements,
    ...overrides,
  }
}
export function subscriptionTenant(
  slug = 'alfa',
  role: TenantContext['role'] = 'ADMIN'
): TenantContext {
  return {
    tenant: { id: slug, slug, name: `Locadora ${slug}`, status: 'ACTIVE' },
    membershipId: `membership-${slug}`,
    role,
  }
}
