import { createOnboardingStatusHandler } from '@gb-locacoes/backend/http'
import type { TenantPrincipal } from '@gb-locacoes/backend/identity'
import { withTenantTransaction } from './tenant'

export function readOnboardingStatus(
  request: Request,
  principal: TenantPrincipal
) {
  return createOnboardingStatusHandler({
    withTenantTransaction,
    environment: () => process.env,
  })(request, principal)
}
