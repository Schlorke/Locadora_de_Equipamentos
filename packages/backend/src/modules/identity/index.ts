export type { Identity, IdentityMail } from './factory'
export { identityEnabled, identityMode } from './configuration'
export type { IdentityMode } from './configuration'
export { inspectIdentityMigration } from './preflight'
export type { IdentityPreflight, LegacyIdentity } from './preflight'
export { migrateLegacyIdentities } from './migration'
export { withTenantTransaction } from './tenant-principal'
export type {
  TenantPrincipal,
  TenantAccess,
  TenantCandidateSource,
  MembershipRecord,
} from './tenant-principal'
export type {
  LegacyAccount,
  LegacyAccountDatabase,
  LegacyCredentialVerification,
  LegacyHeaderSource,
  LegacySignInAttempt,
  LegacySignInDecision,
  LegacySignInGuard,
} from './legacy-credentials'
export type { PlatformEdgeContext } from './platform-edge'
export {
  isSameOriginMutation,
  rejectCrossOriginMutation,
} from './same-origin-mutation'
export type { MutationRequest } from './same-origin-mutation'
export {
  createPublicTenantResolver,
  publicCacheHeaders,
  publicSiteHeaders,
  publicTenantNotFound,
} from './public-tenant'
export type {
  PublicTenant,
  PublicRequestTenant,
  PublicRequestTenantOptions,
} from './public-tenant'
export { clientIpFromHeaders } from './client-ip'
export { createApplicationSessionReader } from './application-session'
export {
  isFreshAuthentication,
  identityAuthenticationTime,
} from './fresh-session'
export { createLegacyAuthentication } from './legacy-auth'
export { createIdentityRuntime } from './runtime'
export { createIdentityMailSender } from './mail'
export {
  listActiveOrganizationMemberships,
  findActiveOrganizationMembership,
} from './organization-memberships'
export { selectedTenantPreferenceCookie } from './tenant-preference'
export { readOrganizationSelection } from './organization-selection'
export { readCurrentOrganizationMembership } from './organization-current'
export { createTenantPrincipalResolver } from './tenant-request-principal'
export type { TenantPrincipalResolution } from './tenant-request-principal'
export { createTenantPermissionResolver } from './tenant-permission'
export { listTenantPermissions } from './tenant-permissions-read'
export {
  createIdentityLimiters,
  createLegacySignInGuard,
  limiterFailureFields,
} from './rate-limit'
export type {
  IdentityLimiterOptions,
  AuthAttemptScope,
  AuthAttemptResult,
  AccountFlowScope,
  AccountNoticeKind,
} from './rate-limit'

export { secretsMatch } from './webhook-auth'
export { authenticatePlatformAsaasWebhook } from './platform-webhook'
export { createTenantWebhookAuthentication } from './tenant-webhook'
export type {
  WebhookProvider,
  WebhookRoute,
  VerifiedIntegration,
  AuthenticatedTenantWebhook,
} from './tenant-webhook'

export { replaceTenantPermissions } from './tenant-permissions-write'

export { createCredentialAccounts } from './credential-accounts'
export { isInboundIntegrationStatus } from './inbound-integration'
