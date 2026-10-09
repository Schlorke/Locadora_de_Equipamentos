'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useOnboardingChecklist } from '../../../entities/onboarding'
import { useApiClientRevision } from '../../../shared/api'

export function usePrimeirosPassos() {
  const tenant = useTenantContext()
  const { data: session, status } = useSession()
  const slug = usePublicTenantSlug()
  const revision = useApiClientRevision()
  const eligible =
    status === 'authenticated' &&
    Boolean(session?.user.id) &&
    tenant?.role === 'ADMIN' &&
    tenant.tenant.status === 'ACTIVE'
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.membershipId,
    tenant?.role,
    tenant?.tenant.status,
    session?.user.id,
    status,
    slug,
    revision,
  ])
  const account = useOnboardingChecklist(scope, eligible)
  return {
    ...account,
    eligible,
    scope,
    tenantName: tenant?.tenant.name,
    tenantSlug: tenant?.tenant.slug,
  }
}
