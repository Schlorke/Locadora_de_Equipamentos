import { createMemoryRateLimiters } from '@gb-locacoes/backend/http'
import type { NextRequest } from 'next/server'
import {
  identityRateLimitSecret,
  prismaRateLimitCounter,
} from '@gb-locacoes/backend/directory'
import {
  createIdentityLimiters,
  createLegacySignInGuard,
  clientIpFromHeaders,
  type IdentityLimiterOptions,
  type AuthAttemptScope,
  type AuthAttemptResult,
  type AccountFlowScope,
  type AccountNoticeKind,
  type LegacySignInGuard,
} from '@gb-locacoes/backend/identity'
export { identityRateLimitSecret } from '@gb-locacoes/backend/directory'
export {
  clientIpFromHeaders,
  limiterFailureFields,
} from '@gb-locacoes/backend/identity'
export type {
  AuthAttemptScope,
  AccountFlowScope,
  AccountNoticeKind,
} from '@gb-locacoes/backend/identity'

const memoryLimiters = createMemoryRateLimiters<NextRequest>({
  clientIp: clientIpFromHeaders,
})
export const adminApiRateLimit = memoryLimiters.adminApiRateLimit
export const strictRateLimit = memoryLimiters.strictRateLimit
export const checkRateLimit = memoryLimiters.checkRateLimit
// The legacy host supplies its real application client, only when a window is needed.
const identityLimiters = createIdentityLimiters({
  loadCounter: async () => {
    const { prisma } = await import('@/lib/prisma')
    return prismaRateLimitCounter(prisma)
  },
  secret: identityRateLimitSecret,
  clientIp: clientIpFromHeaders,
})

export async function consumeAuthAttempt(
  scope: AuthAttemptScope,
  input: { ip: string | null; account: string },
  options: IdentityLimiterOptions = {}
): Promise<AuthAttemptResult> {
  return identityLimiters.consumeAuthAttempt(scope, input, options)
}

export async function clearAuthAccountAttempts(
  scope: AuthAttemptScope,
  account: string,
  ip: string | null,
  options: IdentityLimiterOptions = {}
): Promise<void> {
  return identityLimiters.clearAuthAccountAttempts(scope, account, ip, options)
}

export async function resetAuthAccountAttempts(
  scope: AuthAttemptScope,
  account: string,
  options: IdentityLimiterOptions = {}
): Promise<void> {
  return identityLimiters.resetAuthAccountAttempts(scope, account, options)
}

export async function refuseAuthAttempt(
  scope: AccountFlowScope,
  input: { headers: Headers; account: string },
  message: string,
  options: IdentityLimiterOptions = {}
): Promise<Response | null> {
  return identityLimiters.refuseAuthAttempt(scope, input, message, options)
}

export async function consumeAccountNotice(
  kind: AccountNoticeKind,
  account: string,
  options: IdentityLimiterOptions = {}
): Promise<boolean> {
  return identityLimiters.consumeAccountNotice(kind, account, options)
}

export async function consumeVerificationResend(
  account: string,
  options: IdentityLimiterOptions = {}
): Promise<boolean> {
  return identityLimiters.consumeVerificationResend(account, options)
}

export function legacySignInGuard(
  options: IdentityLimiterOptions = {}
): LegacySignInGuard {
  return createLegacySignInGuard(
    {
      clientIp: clientIpFromHeaders,
      consumeAuthAttempt,
      clearAuthAccountAttempts,
    },
    options
  )
}
