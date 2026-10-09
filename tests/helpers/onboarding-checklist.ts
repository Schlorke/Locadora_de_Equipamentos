import type {
  OnboardingStatusResponse,
  OnboardingChecklistItem,
} from '@gb-locacoes/contracts/onboarding'
import { ONBOARDING_CHECKLIST_ITEMS } from '@gb-locacoes/contracts/onboarding'
import type { SubscriptionStatus } from '@gb-locacoes/contracts/subscription'

export function onboardingChecklistFixture(
  done: OnboardingChecklistItem[] = [
    'ACCOUNT_CREATED',
    'FIRST_EQUIPMENT',
    'CUSTOMIZE_SITE',
  ],
  status: SubscriptionStatus = 'TRIALING',
  expiredCommercialInfo = false
): OnboardingStatusResponse {
  return {
    subscriptionStatus: status,
    items: ONBOARDING_CHECKLIST_ITEMS.filter(
      (id) =>
        (id !== 'SUBSCRIBE' || status === 'TRIALING') &&
        (id !== 'CONFIRM_COMMERCIAL_INFO' || expiredCommercialInfo)
    ).map((id) => ({ id, done: done.includes(id) })),
  }
}
