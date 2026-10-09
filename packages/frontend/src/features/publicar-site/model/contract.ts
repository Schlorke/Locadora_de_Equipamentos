import type { OnboardingStatusResponse } from '@gb-locacoes/contracts/onboarding'
export interface PublicarSiteProps {
  scope: string
  checklist: OnboardingStatusResponse
  tenantName?: string
  tenantSlug?: string
  onPublished(): void
  openPanel?(slug: string): Promise<void>
}
