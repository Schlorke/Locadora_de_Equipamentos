import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { validarCnpj } from '@gb-locacoes/domain/documento'
import { OwnerSubscriptionCommandError } from './owner-command'
import { reactivationPending } from './reactivation-state'

export const issuanceInclude = {
  organization: true,
  planVersion: { include: { plan: true } },
} as const
export type IssuanceSubscription = Prisma.SubscriptionGetPayload<{
  include: typeof issuanceInclude
}>
const legalKinds = [
  'PLATFORM_TERMS',
  'PRIVACY_POLICY',
  'DATA_PROCESSING_AGREEMENT',
  'PAYMENTS_PARTNER_NOTICE',
] as const

/** Uses persisted onboarding consent/profile only; does not invent commercial plans or legal texts. */
export async function readIssuanceProfile(
  tx: Prisma.TransactionClient,
  sub: IssuanceSubscription,
  now: Date
) {
  if (await reactivationPending(tx, sub.id))
    throw new OwnerSubscriptionCommandError(409, 'REACTIVATION_PENDING')
  const org = sub.organization
  if (
    org.status !== 'ACTIVE' ||
    !org.ownerUserId ||
    sub.billingMode !== 'ASAAS' ||
    sub.planVersion.interval !== 'MONTHLY' ||
    !sub.planVersion.amount.isPositive()
  )
    throw new OwnerSubscriptionCommandError(409, 'SUBSCRIPTION_NOT_ACTIVATABLE')
  const owner = await tx.membership.findFirst({
    where: {
      tenantId: sub.tenantId,
      userId: org.ownerUserId,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    select: { id: true },
  })
  if (!owner) throw new OwnerSubscriptionCommandError(409, 'OWNER_REQUIRED')
  if (
    !org.documentNormalized ||
    !validarCnpj(org.documentNormalized) ||
    !org.legalName?.trim()
  )
    throw new OwnerSubscriptionCommandError(409, 'BILLING_PROFILE_REQUIRED')
  const contact =
    sub.billingEmail ??
    org.billingEmail ??
    (
      await tx.$queryRaw<
        { email: string | null }[]
      >`SELECT email FROM platform_user_contacts WHERE id=${org.ownerUserId}`
    )[0]?.email
  const email = z.email().safeParse(contact)
  if (!email.success)
    throw new OwnerSubscriptionCommandError(409, 'BILLING_PROFILE_REQUIRED')
  const accepted = await tx.legalAcceptance.findMany({
    where: {
      tenantId: sub.tenantId,
      userId: org.ownerUserId,
      kind: { in: [...legalKinds] },
      withdrawnAt: null,
      acceptedAt: { lte: now },
    },
    select: { kind: true, version: true, textSha256: true },
  })
  if (
    legalKinds.some(
      (kind) =>
        !accepted.some(
          (row) =>
            row.kind === kind &&
            row.version.trim() &&
            /^[a-f0-9]{64}$/i.test(row.textSha256)
        )
    )
  )
    throw new OwnerSubscriptionCommandError(409, 'LEGAL_ACCEPTANCE_REQUIRED')
  return {
    name: org.legalName.trim(),
    cpfCnpj: org.documentNormalized,
    email: email.data,
    externalReference: 'org:' + org.id,
    notificationDisabled: true as const,
  }
}
