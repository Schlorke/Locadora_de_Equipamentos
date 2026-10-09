import type { createZohoMailClient } from '../modules/communications/zoho-client'
import type { createZohoMailTokenReader } from '../modules/communications/zoho-tokens'
import type { TenantTransactionRunner } from '../modules/rentals/index'
import type { createMemoryRateLimiters } from './memory-rate-limit'
import type { createMemoryIdempotencyCache } from './memory-idempotency'
type Client = ReturnType<typeof createZohoMailClient>
type Tokens = ReturnType<typeof createZohoMailTokenReader>
type Limits<TRequest extends Request> = ReturnType<
  typeof createMemoryRateLimiters<TRequest>
>
export type ZohoMutationContext = { tenantId: string }
export type ZohoMutationPorts = Pick<Client, 'makeZohoMailRequest'> &
  Pick<Tokens, 'getZohoAccessToken' | 'getZohoAccountId'> & {
    withTenantTransaction: TenantTransactionRunner
  }
export type ZohoRatePorts<TRequest extends Request> = Pick<
  Limits<TRequest>,
  'checkRateLimit' | 'strictRateLimit' | 'adminApiRateLimit'
>
export type ZohoSendPorts = ReturnType<typeof createMemoryIdempotencyCache> & {
  withTenantTransaction: TenantTransactionRunner
  logger: {
    info: (_data: Record<string, unknown>, _message: string) => unknown
    error: (_data: Record<string, unknown>, _message: string) => unknown
  }
}
