import { OnboardingStatusResponseSchema } from '@gb-locacoes/contracts/onboarding'
import { semanticThemes } from '@gb-locacoes/design-tokens'
import type { TenantPrincipal } from '../identity/index'
import {
  createOwnerSubscriptionSnapshot,
  OwnerSubscriptionReadError,
} from '../subscriptions/index'

/** Current ownership and checklist facts share the existing scoped READ ONLY snapshot. */
export function createOnboardingStatusReader(
  ports: Parameters<typeof createOwnerSubscriptionSnapshot>[0]
) {
  const read = createOwnerSubscriptionSnapshot(ports)
  return (principal: TenantPrincipal) =>
    read(principal, async (tx) => {
      const tenantId = principal.tenantId
      const current = await tx.subscription.findFirst({
        where: { tenantId, status: { not: 'CANCELED' } },
        select: { status: true },
      })
      const subscription =
        current ??
        (await tx.subscription.findFirst({
          where: { tenantId, status: 'CANCELED' },
          orderBy: [
            { canceledAt: 'desc' },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          select: { status: true },
        }))
      if (!subscription)
        throw new OwnerSubscriptionReadError(404, 'SUBSCRIPTION_NOT_FOUND')
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: tenantId },
        select: { sitePublishedAt: true },
      })
      const setting = await tx.setting.findUnique({
        where: { tenantId },
        select: {
          companyIconUrl: true,
          themeColorPrimary: true,
          whatsappNumber: true,
        },
      })
      const account = await tx.paymentAccount.findFirst({
        where: { tenantId, disconnectedAt: null },
        select: {
          status: true,
          commercialInfoExpired: true,
          healthIssue: true,
          integration: { select: { status: true } },
        },
      })
      const equipments = await tx.equipment.count({ where: { tenantId } })
      return OnboardingStatusResponseSchema.parse({
        subscriptionStatus: subscription.status,
        items: [
          { id: 'ACCOUNT_CREATED', done: true },
          { id: 'FIRST_EQUIPMENT', done: equipments > 0 },
          {
            id: 'CUSTOMIZE_SITE',
            done:
              !!setting &&
              (!!setting.companyIconUrl.trim() ||
                !!setting.whatsappNumber.trim() ||
                (setting.themeColorPrimary.trim().length > 0 &&
                  setting.themeColorPrimary !==
                    semanticThemes.light.brand.default)),
          },
          { id: 'PUBLISH_SITE', done: organization.sitePublishedAt !== null },
          {
            id: 'ACTIVATE_ONLINE_PAYMENTS',
            done:
              account?.status === 'APPROVED' &&
              account.integration.status === 'ACTIVE' &&
              !account.commercialInfoExpired &&
              !account.healthIssue,
          },
          ...(subscription.status === 'TRIALING'
            ? [{ id: 'SUBSCRIBE', done: false }]
            : []),
          ...(account?.commercialInfoExpired
            ? [{ id: 'CONFIRM_COMMERCIAL_INFO', done: false }]
            : []),
        ],
      })
    })
}
