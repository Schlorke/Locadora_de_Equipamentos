import {
  getServerSession as getLegacySession,
  type NextAuthOptions,
  type Session,
} from 'next-auth'
import { headers } from 'next/headers'
import {
  clientIpFromHeaders,
  createApplicationSessionReader,
  identityAuthenticationTime,
  createIdentityLimiters,
  createIdentityMailSender,
  createIdentityRuntime,
  createLegacyAuthentication,
  identityEnabled,
  identityMode,
  limiterFailureFields,
} from '@gb-locacoes/backend/identity'
import {
  identityRateLimitSecret,
  prismaRateLimitCounter,
} from '@gb-locacoes/backend/directory'
import {
  createResendClient,
  getDatabaseRuntime,
} from '@gb-locacoes/backend/runtime'

// Composition only: engines, credential checks and budgets belong to backend.
// Storage and mail are read lazily; importing a route performs no I/O.
const limits = createIdentityLimiters({
  loadCounter: async () => prismaRateLimitCounter(getDatabaseRuntime().prisma),
  secret: () => identityRateLimitSecret(process.env),
  clientIp: clientIpFromHeaders,
})
const guard = limits.legacySignInGuard()
const legacy = createLegacyAuthentication({
  getDatabase: async () => getDatabaseRuntime().prisma,
  signInAttempts: () => guard,
  environment: () => process.env,
  limiterFailureFields,
})
const identity = createIdentityRuntime({
  environment: () => process.env,
  loadDependencies: async () => ({
    database: getDatabaseRuntime().prisma,
    send: createIdentityMailSender({
      client: () => createResendClient(process.env.RESEND_API_KEY),
      from: () => process.env.FROM_EMAIL,
    }),
    verificationResendAllowed: limits.consumeVerificationResend,
    signInGuard: guard,
  }),
})
const readSession = createApplicationSessionReader<Session, NextAuthOptions>({
  mode: () => identityMode(process.env),
  identityEnabled: () => identityEnabled(process.env),
  identity: async () => {
    const session = await (
      await identity.getIdentity()
    ).api.getSession({ headers: await headers() })
    if (!session) return null
    const authenticatedAt = identityAuthenticationTime(
      session.session.createdAt
    )
    return {
      ...(authenticatedAt === undefined ? {} : { authenticatedAt }),
      expires: session.session.expiresAt.toISOString(),
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        role: session.user.role,
      },
    }
  },
  legacy: (options) => getLegacySession(options || legacy.authOptions),
})

export async function getServerSession(
  options?: NextAuthOptions
): Promise<Session | null> {
  return readSession(options)
}

export const authOptions = legacy.authOptions
export function handleIdentityRequest(request: Request): Promise<Response> {
  return identity.handleIdentityRequest(request)
}

export const getIdentity = () => identity.getIdentity()
export const findAccountsByEmail = legacy.findAccountsByEmail
export const consumeAccountNotice = limits.consumeAccountNotice
export const resetAuthAccountAttempts = limits.resetAuthAccountAttempts
export const refuseAuthAttempt = limits.refuseAuthAttempt
