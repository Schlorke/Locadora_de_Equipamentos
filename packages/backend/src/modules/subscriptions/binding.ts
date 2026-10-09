import type { Prisma, Subscription } from '@prisma/client'
import { sameAmount, type AsaasPlatformSubscription } from '../billing/index'

export const matchesRemoteSubscription = (
  sub: Subscription & { planVersion: { amount: Prisma.Decimal } },
  remote: AsaasPlatformSubscription
) =>
  (!sub.providerSubscriptionId || remote.id === sub.providerSubscriptionId) &&
  remote.customer === sub.providerCustomerId &&
  remote.externalReference === 'sub:' + sub.id &&
  remote.cycle === 'MONTHLY' &&
  sameAmount(remote.amount, sub.planVersion.amount)

/** Keep provider-ID precedence used by legacy ingress; consumers validate every supplied hint. */
export async function resolveAsaasSubscription(
  tx: Prisma.TransactionClient,
  hint: {
    providerId: string | null
    reference: string | null
  },
  environment: string
): Promise<Subscription | null> {
  const accepts = (sub: Subscription | null) =>
    sub?.providerEnvironment === environment && sub.billingMode === 'ASAAS'
  if (hint.providerId) {
    const sub = await tx.subscription.findUnique({
      where: { providerSubscriptionId: hint.providerId },
    })
    if (accepts(sub)) return sub
  }
  if (hint.reference?.startsWith('sub:')) {
    const sub = await tx.subscription.findUnique({
      where: { id: hint.reference.slice(4) },
    })
    if (accepts(sub)) return sub
  } else if (hint.reference?.startsWith('inv:')) {
    const invoice = await tx.platformInvoice.findUnique({
      where: { id: hint.reference.slice(4) },
      include: { subscription: true },
    })
    if (accepts(invoice?.subscription ?? null)) return invoice!.subscription
  }
  return null
}

export const subscriptionHintMatches = (
  sub: Subscription,
  hint: { id: string; externalReference: string | null }
) =>
  (hint.externalReference === null ||
    hint.externalReference === 'sub:' + sub.id) &&
  (sub.providerSubscriptionId
    ? hint.id === sub.providerSubscriptionId
    : sub.providerSync === 'UNKNOWN' &&
      hint.externalReference === 'sub:' + sub.id)
