import { createOrganizationSelectionHandler } from '@gb-locacoes/backend/http'
import { findActiveOrganizationMembership } from '@gb-locacoes/backend/identity'
import { prisma } from './prisma'
import { getServerSession } from './application-session'
import { isTrustedMutationOrigin } from './security/mutation-origin'
export const organizationSelection = createOrganizationSelectionHandler({
  getServerSession,
  isTrustedMutationOrigin,
  membership: (userId, tenantId) =>
    findActiveOrganizationMembership(prisma, userId, tenantId),
  secure: () => process.env.NODE_ENV === 'production',
})
