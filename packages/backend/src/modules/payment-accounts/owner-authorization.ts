import type { Prisma } from '@prisma/client'
import { normalizarCnpj, validarCnpj } from '@gb-locacoes/domain/documento'
import { isFreshAuthentication, type TenantPrincipal } from '../identity/index'
import { hasIntegrationSecrets } from '../secrets/index'

const organizationSelect = {
  id: true,
  slug: true,
  ownerUserId: true,
  status: true,
  access: true,
  document: true,
  documentNormalized: true,
  legalName: true,
  companyType: true,
  phone: true,
  billingEmail: true,
  addressLine: true,
  addressNumber: true,
  addressComplement: true,
  district: true,
  postalCode: true,
} satisfies Prisma.OrganizationSelect
export type ReceivingOrganization = Prisma.OrganizationGetPayload<{
  select: typeof organizationSelect
}>

/** Normalized valid CNPJ of the organization, or `null` (legacy formatted column must agree). */
export function receivingDocument(org: {
  document: string | null
  documentNormalized: string | null
}) {
  const document = org.documentNormalized ?? org.document
  if (
    !document ||
    !validarCnpj(document) ||
    (org.document && normalizarCnpj(org.document) !== normalizarCnpj(document))
  )
    return null
  return normalizarCnpj(document)
}

/**
 * Current owner of the receiving account. With `write`, the organization row is locked and the session must be
 * fresh; a READ ONLY transaction (owner offer) never takes `FOR UPDATE`. The caller decides how an unverified
 * e-mail or an invalid CNPJ is reported, so each flow keeps its own order of refusals.
 */
export async function authorizeReceivingOwner(
  tx: Prisma.TransactionClient,
  principal: TenantPrincipal,
  options: {
    write: boolean
    authenticatedAt?: number
    now: Date
    fail(status: 401 | 403, code: string): Error
  }
) {
  if (options.write)
    await tx.$queryRaw`SELECT id FROM organizations WHERE id=${principal.tenantId} FOR UPDATE`
  const member = await tx.membership.findFirst({
    where: {
      id: principal.membershipId,
      tenantId: principal.tenantId,
      userId: principal.userId,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    select: { organization: { select: organizationSelect } },
  })
  const org = member?.organization
  if (
    principal.role !== 'ADMIN' ||
    org?.status !== 'ACTIVE' ||
    org.ownerUserId !== principal.userId
  )
    throw options.fail(403, 'OWNER_REQUIRED')
  if (
    options.write &&
    !isFreshAuthentication(options.authenticatedAt, options.now)
  )
    throw options.fail(401, 'FRESH_SESSION_REQUIRED')
  if (org.access === 'ARCHIVED') throw options.fail(403, 'TENANT_ARCHIVED')
  const contact = (
    await tx.$queryRaw<{ email: string | null; authEmailVerified: boolean }[]>`
      SELECT email, "authEmailVerified" FROM platform_user_contacts WHERE id=${principal.userId}
    `
  )[0]
  return {
    organization: org,
    document: receivingDocument(org),
    emailVerified: contact?.authEmailVerified === true,
    ownerEmail: contact?.authEmailVerified ? contact.email : null,
  }
}

/**
 * An Asaas integration of the company that keeps a new receiving account out. A cancelled creation request leaves a
 * DISABLED vault integration with no secret and no provider reference (a "shell"): it never blocks a new creation
 * or connection. Legacy ENV_REF integrations and any integration that ever held a credential or a provider
 * reference keep blocking.
 */
export async function blockingReceivingIntegration(
  tx: Prisma.TransactionClient,
  tenantId: string,
  currentIntegrationId: string | null
) {
  const integrations = await tx.tenantIntegration.findMany({
    where: { tenantId, provider: 'ASAAS' },
    select: {
      id: true,
      status: true,
      credentialSource: true,
      environment: true,
      externalAccountId: true,
    },
    orderBy: { id: 'asc' },
  })
  for (const integration of integrations) {
    if (integration.id === currentIntegrationId) continue
    if (
      integration.status === 'DISABLED' &&
      integration.credentialSource === 'VAULT' &&
      !integration.externalAccountId &&
      !(await hasIntegrationSecrets(tx, {
        tenantId,
        integrationId: integration.id,
      }))
    )
      continue
    return { id: integration.id }
  }
  return null
}

/** The receiving-account slot of a company: current account, blocking integration and last cancelled request. */
export async function receivingSlot(
  tx: Prisma.TransactionClient,
  tenantId: string
) {
  const current = await tx.paymentAccount.findFirst({
    where: { tenantId, disconnectedAt: null },
    include: { integration: true },
  })
  const blockingIntegration = await blockingReceivingIntegration(
    tx,
    tenantId,
    current?.integrationId ?? null
  )
  const lastCancelled = await tx.paymentAccount.findFirst({
    where: {
      tenantId,
      mode: 'ASAAS_SUBACCOUNT',
      status: 'DISCONNECTED',
      disconnectedAt: { not: null },
    },
    orderBy: [{ disconnectedAt: 'desc' }, { id: 'desc' }],
    select: { lastErrorCode: true },
  })
  return { current, blockingIntegration, lastCancelled }
}
