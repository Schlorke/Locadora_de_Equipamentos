import { findActiveOrganizationMembership } from '@gb-locacoes/backend/identity'
import { createOrganizationSelectionHandler } from '@gb-locacoes/backend/http'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { getServerSession } from './session'
import { isTrustedMutationOrigin } from './mutation-origin'
export const organizationSelection = createOrganizationSelectionHandler({
  getServerSession,
  isTrustedMutationOrigin,
  membership: (userId, tenantId) =>
    findActiveOrganizationMembership(
      getDatabaseRuntime().prisma,
      userId,
      tenantId
    ),
  secure: () => process.env.NODE_ENV === 'production',
})
