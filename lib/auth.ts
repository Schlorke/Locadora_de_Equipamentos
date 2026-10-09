import {
  createLegacyAuthentication,
  type LegacyAccount,
  type LegacySignInGuard,
} from '@gb-locacoes/backend/identity'
import { legacySignInGuard, limiterFailureFields } from './rate-limit'

// Runtime-only Prisma import to prevent build-time initialization; one import
// shared by concurrent sign-ins (a failed import is retried on the next call).
let prismaModule: Promise<typeof import('./prisma')> | undefined
async function getPrisma() {
  prismaModule ??= import('./prisma').catch((error: unknown) => {
    prismaModule = undefined
    throw error
  })
  return (await prismaModule).prisma
}

export type AccountByEmail = LegacyAccount

/**
 * Accounts whose stored e-mail equals `email` once both are normalized
 * (`findLegacyAccountsByEmail`: `_` and `%` never match other addresses; two
 * rows mean an ambiguous address).
 */
export async function findAccountsByEmail(
  email: string
): Promise<AccountByEmail[]> {
  return legacy.findAccountsByEmail(email)
}

/** Attempt windows of the credential sign-in, shared with `/api/auth/v2`. */
let signInGuard: LegacySignInGuard | undefined
const signInAttempts = () => (signInGuard ??= legacySignInGuard())

const legacy = createLegacyAuthentication({
  getDatabase: getPrisma,
  signInAttempts,
  environment: () => process.env,
  limiterFailureFields,
})
export const authOptions = legacy.authOptions

export { withSignInAvailability } from '@gb-locacoes/backend/http'
