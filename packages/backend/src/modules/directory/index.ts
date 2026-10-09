/**
 * Diretório público de locadoras (ADR docs/architecture/adr-tenant-hosts.md).
 * Cartão por slug, busca com opt-in e o rate limit persistente da plataforma
 * (`platform_rate_limits`), também usado pelos limitadores de identidade.
 */
export { readPublicTenantCard } from './card'
export type { TenantCardSubject } from './card'
export {
  escapeLikePattern,
  parseDirectorySearchParams,
  searchDirectory,
} from './search'
export type { DirectorySearchDatabase } from './search'
export {
  DIRECTORY_SEARCH_RATE_LIMIT,
  PLATFORM_RATE_LIMIT_PURGE_GRACE_MS,
  PLATFORM_RATE_LIMIT_SECRET_MIN_LENGTH,
  consumeDirectorySearchRateLimit,
  consumeRateLimitWindow,
  platformRateLimitDigest,
  prismaRateLimitCounter,
  purgeExpiredPlatformRateLimits,
} from './rate-limit'
export type {
  PlatformRateLimitDatabase,
  RateLimitDecision,
  RateLimitWindow,
} from './rate-limit'
export { identityRateLimitSecret } from './security-env'
