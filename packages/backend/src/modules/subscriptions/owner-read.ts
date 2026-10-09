import type { Prisma } from '@prisma/client'
import {
  SubscriptionSummarySchema,
  PlatformInvoicesResponseSchema,
  type SubscriptionSummary,
  type PlatformInvoicesResponse,
} from '@gb-locacoes/contracts/subscription'
import { diaCivilDeColunaDate } from '@gb-locacoes/domain/assinatura'
import type { TenantPrincipal } from '../identity/index'
import { readEffectiveRightsForPlan } from '../entitlements/index'

type ReadPorts = {
  withTenantTransaction<T>(
    context: { tenantId: string },
    operation: (_tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<T>
  now?: () => Date
}

export class OwnerSubscriptionReadError extends Error {
  constructor(
    readonly status: 403 | 404,
    readonly code: 'OWNER_REQUIRED' | 'SUBSCRIPTION_NOT_FOUND'
  ) {
    super(code)
  }
}

const planSelect = {
  version: true,
  interval: true,
  amount: true,
  entitlements: true,
  plan: { select: { code: true, name: true } },
} satisfies Prisma.PlanVersionSelect
type Plan = Prisma.PlanVersionGetPayload<{ select: typeof planSelect }>
const planView = (version: Plan) => ({
  code: version.plan.code,
  name: version.plan.name,
  version: version.version,
  interval: version.interval,
  amount: version.amount.toFixed(2),
})
const civil = (date: Date | null) => (date ? diaCivilDeColunaDate(date) : null)

/** Fresh ownership, subscription and usage share one scoped, read-only snapshot. */
export function createOwnerSubscriptionSnapshot(ports: ReadPorts) {
  return <T>(
    principal: TenantPrincipal,
    operation: (_tx: Prisma.TransactionClient, _access: string) => Promise<T>
  ) =>
    ports.withTenantTransaction(
      principal,
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`
        const membership = await tx.membership.findFirst({
          where: {
            id: principal.membershipId,
            tenantId: principal.tenantId,
            userId: principal.userId,
            role: 'ADMIN',
            status: 'ACTIVE',
          },
          select: {
            organization: {
              select: { status: true, access: true, ownerUserId: true },
            },
          },
        })
        const org = membership?.organization
        if (
          !org ||
          org.status !== 'ACTIVE' ||
          org.ownerUserId !== principal.userId
        )
          throw new OwnerSubscriptionReadError(403, 'OWNER_REQUIRED')
        return operation(tx, org.access)
      },
      { isolationLevel: 'RepeatableRead' }
    )
}

export function createOwnerSubscriptionReader(ports: ReadPorts) {
  const read = createOwnerSubscriptionSnapshot(ports)
  const select = {
    status: true,
    billingMode: true,
    scheduledChangeAt: true,
    trialEndsAt: true,
    currentPeriodStart: true,
    currentPeriodEnd: true,
    pastDueSince: true,
    graceEndsAt: true,
    suspendedAt: true,
    complimentaryUntil: true,
    cancelAtPeriodEnd: true,
    canceledAt: true,
    cancelReason: true,
    planVersion: { select: planSelect },
    scheduledPlanVersion: { select: planSelect },
  } satisfies Prisma.SubscriptionSelect

  return {
    readSummary(principal: TenantPrincipal): Promise<SubscriptionSummary> {
      return read(principal, async (tx, access) => {
        const current = await tx.subscription.findFirst({
          where: { tenantId: principal.tenantId, status: { not: 'CANCELED' } },
          select,
        })
        const sub =
          current ??
          (await tx.subscription.findFirst({
            where: { tenantId: principal.tenantId, status: 'CANCELED' },
            orderBy: [
              { canceledAt: 'desc' },
              { createdAt: 'desc' },
              { id: 'desc' },
            ],
            select,
          }))
        if (!sub)
          throw new OwnerSubscriptionReadError(404, 'SUBSCRIPTION_NOT_FOUND')
        const entitlements = await readEffectiveRightsForPlan(
          tx,
          principal.tenantId,
          sub.planVersion.entitlements,
          (ports.now ?? (() => new Date()))()
        )
        const equipments = await tx.equipment.count({
          where: { tenantId: principal.tenantId },
        })
        const staffSeats = await tx.membership.count({
          where: {
            tenantId: principal.tenantId,
            status: 'ACTIVE',
            role: { not: 'CLIENT' },
          },
        })
        return SubscriptionSummarySchema.parse({
          status: sub.status,
          access,
          billingMode: sub.billingMode,
          plan: planView(sub.planVersion),
          scheduledPlan: sub.scheduledPlanVersion
            ? planView(sub.scheduledPlanVersion)
            : null,
          scheduledChangeAt: civil(sub.scheduledChangeAt),
          trialEndsAt: civil(sub.trialEndsAt),
          currentPeriodStart: civil(sub.currentPeriodStart),
          currentPeriodEnd: civil(sub.currentPeriodEnd),
          pastDueSince: civil(sub.pastDueSince),
          graceEndsAt: civil(sub.graceEndsAt),
          suspendedAt: sub.suspendedAt?.toISOString() ?? null,
          complimentaryUntil: civil(sub.complimentaryUntil),
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          canceledAt: sub.canceledAt?.toISOString() ?? null,
          cancelReason: sub.cancelReason,
          entitlements,
          usage: { equipments, staffSeats },
        })
      })
    },
    readInvoices(
      principal: TenantPrincipal
    ): Promise<PlatformInvoicesResponse> {
      return read(principal, async (tx) => {
        const invoices = await tx.platformInvoice.findMany({
          where: { tenantId: principal.tenantId },
          orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          take: 100,
          select: {
            id: true,
            kind: true,
            status: true,
            amount: true,
            dueDate: true,
            periodStart: true,
            periodEnd: true,
            billingType: true,
            invoiceUrl: true,
            paidAt: true,
            canceledReason: true,
          },
        })
        return PlatformInvoicesResponseSchema.parse({
          invoices: invoices.map((invoice) => ({
            id: invoice.id,
            kind: invoice.kind,
            status: invoice.status,
            amount: invoice.amount.toFixed(2),
            dueDate: diaCivilDeColunaDate(invoice.dueDate),
            periodStart: civil(invoice.periodStart),
            periodEnd: civil(invoice.periodEnd),
            billingType: invoice.billingType,
            invoiceUrl: invoice.invoiceUrl,
            paidAt: invoice.paidAt?.toISOString() ?? null,
            canceledReason: invoice.canceledReason,
          })),
        })
      })
    },
  }
}
